# Instances

Covers creating, configuring, limiting, executing into, troubleshooting, snapshotting, and backing up instances. For images/remotes/profiles see [images-profiles.md](images-profiles.md); for pools and volumes see [storage.md](storage.md); for NIC and bridge details see [networking.md](networking.md).

## Create an instance

```bash
incus launch images:debian/12 web            # create and start a container
incus init images:debian/12 web              # create without starting
incus launch images:debian/12 web --vm       # create and start a virtual machine
```

Reach for `init` instead of `launch` when you still need to inject configuration:
cloud-init runs once on first boot, so anything set after the instance has started
is silently ignored. Pattern:

```bash
incus init images:ubuntu/24.04 webapp
incus config set webapp limits.cpu=1 limits.memory=512MiB
incus config set webapp cloud-init.user-data <<'EOF'
#cloud-config
package_upgrade: true
packages:
  - nginx
runcmd:
  - [sh, -c, "echo 'hello from incus' > /var/www/html/index.html"]
EOF
incus start webapp
```

The same YAML can go inline at create time with repeated `--config key=value`
flags (`launch … --config limits.cpu=1 --config limits.memory=512MiB`) or be piped
as a full config file: `incus launch images:debian/12 web < config.yaml`.
Run `incus config show <inst> --expanded` on a similar instance to see valid syntax.

Key creation flags:

| Flag | Purpose |
| --- | --- |
| `--vm` | Create a VM instead of a container. Same image name resolves to a different VM-compatible build; a container-only image fails to boot as a VM. |
| `--config k=v` | Set one instance option (repeatable). |
| `--device name,opt=v` | Override a profile-provided device, or size the root disk: `--device root,size=30GiB`. |
| `--profile p` | Attach a profile instead of the default (repeatable). |
| `--network n` / `--storage pool` | Use a specific network or storage pool at creation. |
| `--empty --vm` | Blank VM, e.g. for installing from an ISO. |
| `--ephemeral` | Instance deletes itself when stopped. |

Names must be 1–63 chars of ASCII letters, digits, and dashes, without starting
with a digit or dash — the name becomes the guest hostname and a DNS record.
Check progress with `cloud-init status --wait` inside the guest, since first-boot
setup can take minutes before services are reachable.

VM-only notes:

- `exec`, `file`, and rich `info` need the Incus agent inside the guest. Images
  from the `images:` remote ship it; for foreign ISO installs, attach
  `disk source=agent:config` and run `install.sh` from the mount.
- Boot from ISO: `incus init iso-vm --empty --vm`, import the ISO with
  `incus storage volume import <pool> file.iso iso-volume --type=iso`, attach it
  with `boot.priority=10`, then `incus start iso-vm --console`.
- `security.secureboot=true` (default) enforces UEFI secure boot; disable it for
  OS installers that lack signed shim loaders.

## Instance options

Set at creation or later with `incus config set <inst> key=value`; unset with
`config unset`. Options marked live-update apply immediately, the rest need a
restart — check `incus config show --expanded` and restart when in doubt.

| Option | Effect | Notes |
| --- | --- | --- |
| `limits.cpu` | CPUs visible to the instance. A number (`2`) load-balances across the host; a list/range (`1,2` / `0-3`) pins to those cores. VMs also accept `sockets=2,cores=4,threads=2` topology. | Live-update. VM default 1 vCPU; topology values require a stop. |
| `limits.cpu.allowance` | Soft `%` or hard time slice (`100ms/100ms` = one CPU worth). Container-only; pairs with `limits.cpu.priority` when overcommitting. | Live-update. |
| `limits.memory` | Fixed value (`512MiB`, `4GiB`) or percentage of host RAM. VM default 1 GiB. | Live-update. VM shrink relies on ballooning and can lag; re-apply if short. |
| `limits.disk.priority` | I/O priority 0–10 under load (default 5). | Live-update. |
| `security.nesting` | Allow nesting (containers running Incus/Docker; VM nested virt). Default false for containers, true for VMs. | Container value needs a restart. |
| `security.privileged` | Run the container without a UID map (host root == container root). Avoid: a container escape then owns the host. Prefer isolated unprivileged containers below. | Requires restart. |
| `security.idmap.isolated` | Give this unprivileged container a unique UID range, so even root-mapped IDs differ between containers. Needs a reboot; see `security.idmap.size/base`. | Restart required. |
| `security.protection.delete` / `.start` | Block accidental `delete` / `start`. Cheap insurance for long-lived instances. | Live-update. |
| `boot.autostart` | Start with the daemon. Unset means restore last state. Order with `boot.autostart.priority`, delay with `boot.autostart.delay`. | Restart required to change. |
| `snapshots.schedule` | Cron-like automatic snapshots, e.g. `@daily`; pair with `snapshots.expiry` (e.g. `7d`) and `snapshots.pattern`. | New snapshots only. |
| `environment.*` | Environment variables handed to every `incus exec`. | Applies at next exec. |
| `raw.lxc` / `raw.qemu*` | Pass-through to LXC/QEMU internals. Escape hatch for broken guests (e.g. `raw.lxc='lxc.init.cmd = /bin/bash'` to bypass a failing init). Can break Incus in non-obvious ways; treat as last resort. |

Volatile keys (`volatile.*`) are daemon bookkeeping — image fingerprint
(`volatile.base_image`), last power state, generated MACs. They are not user-settable;
leave them alone so state tracking stays correct.

Containers run unprivileged by default: container UID 0 maps to a high host UID
(from `/etc/subuid`/`/etc/subgid`). This is what makes escapes harmless. To bind-mount
host paths owned by real UIDs, add a custom mapping with `raw.idmap` (e.g.
`both 1000 1000`) instead of going privileged.

## Devices

Add with `incus config device add <inst> <devname> <type> key=value…`, adjust with
`config device set`, drop with `config device remove`. Device names must be unique
per instance (≤64 chars); an instance device overrides a profile device of the same
name. Containers hotplug nearly everything; VM hotplug varies by type.

| Type | Purpose | Container / VM | Hotplug |
| --- | --- | --- | --- |
| `disk` | Mount a volume, host path, or ISO into the instance (`pool=`+`source=`, or host `source=`+in-instance `path=`). | both | yes |
| `nic` | Network interface. Prefer `network=<managed-net>` over raw `nictype=` so Incus fills in the details. Types: bridged, macvlan, sriov, physical, ovn, ipvlan, p2p, routed. | both | yes (except ipvlan) |
| `proxy` | Forward host port/socket traffic into the instance: `listen=tcp:0.0.0.0:8080 connect=tcp:127.0.0.1:80`. NAT mode (`nat=true`) preserves client IPs but requires the host to be the gateway. | containers (all modes), VMs (NAT only) | yes |
| `gpu` | GPU passthrough (`gputype=physical` default). VM-only types: mdev, sriov, native-context; container-only: mig. One GPU per device on VMs. | both | containers only |
| `usb` | Pass a USB device (`vendorid=`, `productid=`). Vanishes from the host while attached. | both | yes |
| `tpm` | Software TPM 2.0 emulator for key sealing and measured boot (e.g. BitLocker in Windows VMs). | both | containers only |
| `unix-char` / `unix-block` | Expose a host character/block device node under `/dev` in the container (`source=/dev/…`). Needed when a kernel driver owns the device. | containers | yes |
| `unix-hotplug` | Like unix-char but udev-driven: attaches/detaches automatically as hardware appears. Needs systemd-udev on the host. | containers | yes |
| `pci` | Raw PCI passthrough (`address=0000:xx:yy.z`) for odd single-function cards; prefer `gpu`/`nic` devices where they exist. | VMs | no |
| `infiniband` | IB passthrough (`nictype=physical` or `sriov`). | both | containers only |
| `none` | Placeholder that blocks inheritance of a same-named profile device. | both | — |

Every instance already carries standard devices (root `disk`, `eth0` nic). Inspect
the effective set with `incus config show <inst> --expanded`.

## Run commands and move files

`incus exec <inst> -- <command>` runs inside the instance with no networking
required — the transport is the daemon itself for containers, the agent for VMs.
The `--` separator matters: flags meant for the inner command are eaten by
`incus` otherwise.

Exec always runs as UID/GID 0 with cwd `/root`: Incus deliberately ignores
`/etc/passwd` rather than trusting guest files, so it cannot resolve names.
Override numerically with `--user`, `--group`, `--cwd`; pass variables with
`--env VAR=value` or persist them as `environment.*` options. Get a shell with
`incus exec <inst> -- bash`, or log in as another user with
`incus exec <inst> -- su --login alice`.

File operations take `<instance>/<path>` arguments:

```bash
incus file push app.conf web/etc/app.conf        # single file
incus file push -r ./site/ web/var/www/          # recursive directory
incus file pull web/etc/hosts .                  # out to local path
incus file pull web/var/log/syslog - | less      # "-" streams to stdout
incus file edit web/etc/hosts                    # existing files only
incus file delete web/tmp/old.conf
incus file mount web/root                        # SFTP listener for sshfs
```

For large trees, tar streaming beats thousands of round-tripping file ops:

```bash
tar -C /local/data -cf - . | incus exec web -- tar -C /srv/data -xf -
```

When wrapping in `ssh`/`orb`, each layer strips one round of quotes — test the
inner command with `echo` first.

## Console and troubleshooting

`incus console <inst>` attaches to the serial console, available from early boot —
useful before any agent/network exists. Leave with `ctrl+a-q`. Variants:
`incus start <inst> --console` (attach immediately), `--show-log` (dump console log),
and `--type=vga` for graphical output on VMs (needs a SPICE client such as
`remote-viewer`).

A failed start leaves the instance in an error state. Diagnose in order:

```bash
incus info web                 # status, resources, devices, snapshots
incus info web --show-log      # the daemon-side instance log — read this first
incus console web --show-log   # guest boot/console output
```

Common causes:

- Missing image prerequisites: containers need empty `/dev`, `/proc`, `/sys` and
  an executable `/sbin/init` in the image, because Incus bind-mounts those itself
  and an unprivileged container cannot create them. Symptoms like
  `Failed to mount sysfs at /sys` mean a broken image template, not an Incus bug.
- Init system failing: drop to a shell with
  `incus config set web raw.lxc='lxc.init.cmd = /bin/bash'` and start again.
- Resource exhaustion or bad device config shows up in `info --show-log`;
  a wrong device option usually names the offending key directly.

## Snapshots and backups

Snapshots are cheap copy-on-write points stored beside the instance in its pool:

```bash
incus snapshot create web clean          # optional name, else snapN
incus snapshot restore web clean         # roll back (destroys later state)
incus snapshot delete web clean          # immediate and unrecoverable
incus info web                           # lists snapshots
incus config edit web/clean              # only editable field: expiry
```

Restore rewrites the instance in place — anything written after the snapshot is
gone, so confirm intent before restoring. Add `--stateful` (VMs, plus
`snapshot create --stateful`) to capture live RAM; stateful containers are
unreliable due to CRIU limitations.

Three backup layers, weakest to strongest:

1. **Snapshot** — instant rollback within the same pool; dies with the pool.
2. **Export** — standalone archive: `incus export web [path] [--instance-only]`.
   By default it includes all snapshots; `--instance-only` skips them. Restore
   anywhere with `incus import path.tgz [new-name]` (fails if the original name
   still exists).
3. **Copy** — `incus copy src dst` to a second server keeps a live replica.

Attached custom volumes are separate objects: exporting an instance does not
include their data — back volumes up separately (see [storage.md](storage.md)).
