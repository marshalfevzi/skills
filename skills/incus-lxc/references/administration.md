This file covers daemon-level operations: server initialization and tuning, API exposure,
projects, clustering, debugging, metrics, backups, and authorization; instances live in [instances.md](instances.md), storage in [storage.md](storage.md), networks in [networking.md](networking.md).

## Initialize the server

Run `sudo incus admin init` on a fresh install; it asks about clustering, networking,
storage, remote access, and image auto-update. For a quick throwaway setup, skip the questions:

```bash
sudo incus admin init --minimal
```

The minimal setup picks the `dir` storage driver, which is slower than `zfs` or `btrfs`
and lacks fast snapshots, copies, quotas, and optimized backups — acceptable for tests,
not for anything you will grow.

For repeatable installs, feed a preseed YAML instead:

```bash
cat <<EOF | sudo incus admin init --preseed
{
  "config": {"core.https_address": "192.0.2.10:8443"},
  "storage_pools": [{"name": "default", "driver": "dir"}],
  "networks": [{"name": "incusbr0", "type": "bridge",
                "config": {"ipv4.address": "auto", "ipv6.address": "none"}}],
  "profiles": [{"name": "default", "devices": {
                  "root": {"path": "/", "pool": "default", "type": "disk"}}}]
}
EOF
```

Preseed merges into existing state rather than replacing it, rolling back applied changes
on conflict (for example, changing a pool's driver). Re-running against a configured daemon
is safe; verify the result with `incus config show` and `incus storage list`.

## Server configuration

```bash
incus config set <key>=<value>   # one option
incus config show                # current config
incus config edit                # full YAML
```

Options worth setting beyond the init defaults:

| Key | Why |
| --- | --- |
| `core.https_address` | Binds the HTTPS API; `:8443` listens on all addresses, a specific IP limits exposure. Unset = local Unix socket only. |
| `core.metrics_address` | Dedicated HTTPS address serving only `/1.0/metrics`, so scrapers never touch the full API. |
| `core.metrics_authentication` | Set `false` only when a firewall already guards the endpoint; unauthenticated metrics leak usage data. |
| `core.remote_token_expiry` | Bounds how long a client trust token works (default: no expiry) — expire them so minted-but-unused tokens don't linger. |
| `cluster.join_token_expiry` | Same idea for cluster join tokens (default `3H`). |
| `cluster.max_voters` | Database voting members (default 3); raise only when you understand quorum implications. |
| `instances.placement.scriptlet` | Custom scriptlet deciding where clustered instances land automatically. |
| `oidc.issuer` | Enables OpenID Connect authentication against your identity provider. |

In a cluster, options marked *global* replicate to every member; *local* options
(like `core.https_address`) apply per member — pass `--target <member>` to set them remotely.

## Expose the API safely

By default only local users through the Unix socket can reach Incus. To expose it:

```bash
incus config set core.https_address=10.68.216.12:8443   # a specific IP beats :8443's wildcard
```

Pair exposure with a firewall rule allowing the Incus port only from authorized
subnets; the API grants root-equivalent control of the host to anyone who authenticates.

Authenticate clients through trust tokens (the recommended flow):

```bash
# Server: prints a single-use token
incus config trust add <client-name>
# Client: uses it (add the external/public address manually when behind NAT)
incus remote add <remote-name> <token>
```

Tokens are single-use and honor `core.remote_token_expiry`; revoke clients with
`incus config trust remove <fingerprint>` after listing them with `incus config trust list`.
See [images-profiles.md](images-profiles.md) for client-side remote configuration.

## Projects

Projects partition a server into isolated namespaces. Commands act inside the *current*
project, so run `incus project list` before mutating anything on a multi-project server.

```bash
incus project create <name>
incus project switch <name>                      # or pass --project <name> per command
incus list --project <name>                      # list inside one project
incus move web web --project default --target-project staging   # move between projects
```

Feature flags decide what a project isolates versus inherits from `default`:

| Key | Initial value at creation |
| --- | --- |
| `features.profiles` | `true` |
| `features.images` | `true` |
| `features.storage.volumes` | `true` |
| `features.storage.buckets` | `true` |
| `features.networks` | `false` (needs OVN to enable) |
| `features.networks.zones` | `false` |

Two traps live here. First, a fresh project has its own empty profile set, so instance
creation fails with "No root device could be found" — seed its `default` profile:

```bash
incus profile show default --project default | incus profile edit default
```

Second, feature flags cannot change while a project holds instances, and unsetting a
flag returns it to its plain default (`false`), not the value creation applied.

Confinement restricts what project members may do: `restricted=true` blocks security-
sensitive features (re-enable selectively with `restricted.*` keys), while project limits
like `limits.containers`, `limits.cpu`, `limits.memory` enforce aggregate bounds across instances:

```bash
incus project set contractors restricted=true
incus project set contractors restricted.containers.nesting=allow
```

## Clustering

A cluster shares one distributed database across members; any client can talk to any
member and see the same view. Form one by running `sudo incus admin init` on the
bootstrap member answering yes to clustering, then join further members:

```bash
# On an existing member: mint a single-use join token
incus cluster add <new-member-name>
# On the new member: sudo incus admin init, answer yes to joining, paste the token
```

Joining wipes all existing data on the joining server — use freshly installed ones. Operate
members with `incus cluster list` / `cluster show` / `cluster info`; place instances deliberately:

```bash
incus launch images:debian/12 c1 --target=server2     # specific member
incus launch images:debian/12 c2 --target=@gpu        # member of a cluster group
```

Group members with `incus cluster group create gpu` and `incus cluster group assign
server1 gpu`; group targeting needs `scheduler.instance` set to `all` or `group`. Add roles
with `incus cluster role add <member> event-hub` (only non-automatic roles).

For maintenance, drain a member and refill it afterwards:

```bash
incus cluster evacuate server2    # migrates instances away, marks it evacuated
incus cluster restore server2     # brings instances back after reboot/patching
```

Remove idle members cleanly with `incus cluster remove <member>`; force-removing an
offline member leaves its local state inconsistent, so plan a full reinstall of that
host. If quorum is lost (a majority of database voters died), recovery starts at
`sudo incus admin cluster recover-from-quorum-loss` on a surviving database member —
treat it as a last resort and read the recovery guide before running it.

## Daemon behavior and debugging

On startup the daemon recreates its directory layout if missing and restarts instances whose
recorded power state says they were running. SIGINT/SIGTERM stop only the daemon — instances
keep running and are adopted again on restart — while SIGPWR (host shutdown) shuts instances
down cleanly, killing leftovers after 30 seconds.

State lives under `/var/lib/incus/`: Unix socket, databases (`database/local.db`,
`database/global/`), certificates.

When the daemon misbehaves:

```bash
incus monitor --pretty                        # stream events/logs as they occur
incus --debug list                            # client-side internals for any command
curl --unix-socket /var/lib/incus/unix.socket incus/1.0 | jq .   # raw API sanity check
sudo journalctl -u incus.service              # daemon log on systemd hosts
incus admin sql local .dump > local.sql      # database dumps (also useful pre-upgrade)
```

Instance-level troubleshooting (log files, console) belongs to [instances.md](instances.md).

## Metrics

Incus exposes Prometheus-format metrics at `/1.0/metrics`: CPU, memory, disk, network, and
process usage per instance. Values refresh on scrape and cache for 8 seconds, and scraping is
expensive — widen the interval before hammering it. In a cluster, scrape each member separately.

Expose the endpoint with `core.metrics_address` (metrics-only port) or reuse `core.https_address`.
Authenticate scrapers with a dedicated `metrics`-type certificate, unable to touch instances:

```bash
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:secp384r1 -sha384 \
  -keyout metrics.key -nodes -out metrics.crt -days 3650 -subj "/CN=metrics.local"
incus config trust add-certificate metrics.crt --type=metrics
```

Disabling authentication with `core.metrics_authentication=false` trades usage privacy
for convenience — do it only behind a firewall that already restricts the port.

## Backup and migration

A complete backup is a tarball of `/var/lib/incus` taken while the daemon is stopped, plus
anything stored outside it (ZFS zpools, LVM volumes) and `/etc/subuid`/`/etc/subgid` when
present — restoring those avoids needless UID-shift rewrites of instance filesystems.

- **Exports**: `incus export <inst>|<volume> <file>.tar.gz` produces portable tarballs
  (snapshots included by default; `--optimized` shrinks them but pins the storage driver).
- **Secondary server**: regular `incus copy` of instances/volumes to spare hardware.
- **Snapshots** are point-in-time copies inside the same pool — convenient rollback,
  not a backup, because pool loss takes them too.
- **Database dumps**: `incus admin sql local .dump` and `incus admin sql global .dump`
  make rebuilding profiles/networks far easier even though they don't restore directly.

Moving between servers: `incus copy`/`move` across remotes (see
[images-profiles.md](images-profiles.md)); VMs support live migration. To adopt existing
machines, `incus-migrate` imports a disk/partition as an instance, `lxc-to-incus` converts
classic LXC containers, and `lxd-to-incus` migrates a whole LXD installation in place.

## Security model and authorization

Local access is group-based: `incus-admin` means full daemon control (root-equivalent over
the host), while plain `incus` members each get a confined per-user project created on their
first command. Remotely, unauthenticated clients see only public images; trusted TLS
certificates get full access unless restricted.

Three mechanisms shape who may do what:

- **Restricted TLS identities**: mark a certificate restricted and pin it to projects —
  `incus config trust add --projects <name> --restricted` mints such a token directly.
  Restricted clients also lose the ability to alter global configuration.
- **OIDC**: users authenticate through your identity provider; every OIDC user today receives
  full access, so pair it with fine-grained authorization (OpenFGA) when that matters.
- **Authorization routing**: `authorization.client.*` keys route each client class (unix,
  tls, tls-restricted, oidc, default) to a method (`allow`, `deny`, `tls`, `openfga`,
  `scriptlet`). Built-in routing allows everything except unknown classes; set
  `authorization.client.default` last — a mistake there locks out all remote clients at once.
  Root via the Unix socket always retains access as the recovery path.
