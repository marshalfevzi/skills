# Run transcript — eval 3 (isolated-project-network) — with_skill / run-1

Token: `ws3a-` prefix on every created name.

## Name mapping

| Requested | Created |
| --- | --- |
| project `contractors` | `ws3a-contractors` |
| container `sandbox` | `ws3a-sandbox` |
| contractor bridge | `ws3a-br0` (default-project managed network, used by the project) |

## Skill routing followed

SKILL.md → projects → `references/administration.md`; bridges/NICs → `references/networking.md`.
Key guidance applied: seed the fresh project's empty profile set before launching;
pass `--project` explicitly everywhere; prefer managed networks; probe before promising.

## Environment check

```
$ orb -m incus-test incus --version
6.0.0
$ orb -m incus-test incus list
(empty of ws3a-* names; other runs' ws1a-webapp, ws2a-bulk, ws2b-bulk present)
```

Daemon reachable. Incus 6.0.0.

## Feasibility probe: can a bridge live inside a non-OVN project?

```
$ orb -m incus-test incus project create ws3a-probe
Project ws3a-probe created
$ orb -m incus-test incus project set ws3a-probe features.networks=true   # OK
$ orb -m incus-test incus network create ws3a-probebr0 --project ws3a-probe ipv4.address=10.200.99.1/24 ipv6.address=none
Error: Failed loading network: OVN isn't currently available
$ orb -m incus-test incus network list --project ws3a-probe
(no networks)
```

Finding: this daemon has no OVN, so `features.networks=true` yields an EMPTY network
view — managed bridges cannot be created or seen inside the project. Therefore:
keep `features.networks=false` (project inherits default-project networks), create the
separate bridge in the default project as `ws3a-br0`, and point the contractor
profile's eth0 at it. Traffic still rides its own bridge, distinct from `incusbr0`.

## Step 1 — Create the contractor project

```
$ orb -m incus-test incus project create ws3a-contractors
Project ws3a-contractors created
$ orb -m incus-test incus project show ws3a-contractors
config:
  features.images: "true"
  features.profiles: "true"          <- own profile set
  features.storage.buckets: "true"
  features.storage.volumes: "true"
name: ws3a-contractors
```

`features.profiles=true` → the project has its OWN profiles, isolated from `default`.
`features.networks` left at its default (`false`) — see probe above for why.

## Step 2 — Separate bridge in the default project

```
$ orb -m incus-test incus network create ws3a-br0 ipv4.address=10.100.50.1/24 ipv6.address=none
Network ws3a-br0 created
$ orb -m incus-test incus network show ws3a-br0
type: bridge / managed: true / status: Created
ipv4.address: 10.100.50.1/24   (distinct subnet from incusbr0's 10.76.67.1/24)
```

## Step 3 — Seed the project's empty profile set (skill-documented trap)

A fresh project has an empty profile list; launching without seeding fails with
"No root device could be found". Copy the stock default profile into the project,
then point its eth0 NIC at the contractor bridge:

```
$ orb -m incus-test incus profile show default --project default | \
    orb -m incus-test incus profile edit default --project ws3a-contractors
$ orb -m incus-test incus profile device set default eth0 network=ws3a-br0 --project ws3a-contractors
$ orb -m incus-test incus profile show default --project ws3a-contractors
devices:
  eth0:
    name: eth0
    network: ws3a-br0        <- contractor traffic rides ws3a-br0, not incusbr0
    type: nic
  root:
    path: /
    pool: default
    type: disk
```

## Step 4 — Launch Alpine sandbox inside the project

```
$ orb -m incus-test incus launch images:alpine/edge ws3a-sandbox --project ws3a-contractors
(image fetched, container started)
```

## Step 5 — Prove isolation

### 5a. Invisible from the default project

```
$ orb -m incus-test incus list                          # DEFAULT project
| ws1a-webapp | FROZEN ... | ws2a-bulk | RUNNING | ws2b-bulk | RUNNING |
-> NO ws3a-sandbox entry

$ orb -m incus-test incus list --project ws3a-contractors
| ws3a-sandbox | RUNNING | 10.100.50.114 (eth0) | CONTAINER | 0 |
-> visible only inside its own project
```

### 5b. Traffic rides a separate bridge

```
$ orb -m incus-test ip -br addr show ws3a-br0
ws3a-br0         UP             10.100.50.1/24
$ orb -m incus-test ip -br addr show incusbr0
incusbr0         UP             10.76.67.1/24 ...
-> two distinct bridges, distinct subnets

$ orb -m incus-test incus exec --project ws3a-contractors ws3a-sandbox -- ip -4 addr show eth0
inet 10.100.50.114/24 brd 10.100.50.255 scope global eth0
-> sandbox is addressed on the ws3a-br0 subnet only

$ orb -m incus-test incus network show ws3a-br0   (used_by)
- /1.0/instances/ws3a-sandbox?project=ws3a-contractors
- /1.0/profiles/default?project=ws3a-contractors
-> the ONLY users of the contractor bridge are the sandbox and its profile
```

### 5c. Outbound connectivity through the dedicated bridge

First attempt failed (100% packet loss to 8.8.8.8): user-created networks do not
NAT by default here (`incus network get ws3a-br0 ipv4.nat` returned unset). Per the
networking reference, enabled masquerading:

```
$ orb -m incus-test incus network set ws3a-br0 ipv4.nat=true     -> true
$ orb -m incus-test incus exec --project ws3a-contractors ws3a-sandbox -- ping -c 2 -W 3 8.8.8.8
2 packets transmitted, 2 packets received, 0% packet loss
round-trip min/avg/max = 32.018/32.435/32.853 ms
```

## Final state (all resources left RUNNING and in place)

- project `ws3a-contractors` — features.profiles/images/storage.* = true
- network `ws3a-br0` — managed bridge, 10.100.50.1/24, ipv4.nat=true
- profile `default` in project `ws3a-contractors` — root on pool `default`, eth0 on ws3a-br0
- instance `ws3a-sandbox` — Alpine edge, RUNNING, 10.100.50.114 via ws3a-br0
- leftover probe artifacts from the feasibility check: project `ws3a-probe`
  (empty, no networks — creation of a bridge inside it errored), left in place per
  the "clean up nothing" rule.
