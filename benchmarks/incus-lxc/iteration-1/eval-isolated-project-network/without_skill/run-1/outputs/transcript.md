# Eval 3 (isolated-project-network) — without skill — run-1

Collision token: `ws3b-` (all created names prefixed).
Name mapping:
- requested project `contractors` → **`ws3b-contractors`**
- dedicated bridge → **`ws3b-br0`** (shortened: Linux interface names max 15 chars)
- profile(s) → project's own `default` profile (`Default Incus profile for project ws3b-contractors`)
- instance `sandbox` → **`ws3b-sandbox`** (Alpine 3.22)

## Environment check

```
$ orb -m incus-test incus --version
6.0.0
$ orb -m incus-test incus list        # daemon reachable, other runs' instances visible
$ orb -m incus-test incus storage list
| default | dir | /var/lib/incus/storage-pools/default | CREATED |   # NOTE: pool named "default", not "local"
```

## Step 1 — create the project with its own profiles + networks

```
$ orb -m incus-test incus project create ws3b-contractors \
    -c features.profiles=true -c features.networks=true -c features.images=true
Project ws3b-contractors created
$ orb -m incus-test incus project show ws3b-contractors
config:
  features.images: "true"
  features.networks: "true"
  features.profiles: "true"
name: ws3b-contractors
used_by:
- /1.0/profiles/default?project=ws3b-contractors      # project got its own empty default profile
```

## Step 2 — dedicated network

First attempt inside the project failed:

```
$ orb -m incus-test incus network create --project ws3b-contractors --type=bridge ws3b-contractors-br0
Error: Network interface is too long (maximum 15 characters)   # after shortening to ws3b-br0:
Error: Network type does not support non-default projects      # bridge networks cannot be project-scoped
$ orb -m incus-test incus network create --project ws3b-contractors ws3b-contractors-br0   # no --type => defaults to ovn in non-default project
Error: OVN isn't currently available
```

Workaround (documented in user_notes.md): managed bridges live in the default project;
create one there and wire the contractor project's profile NIC to it:

```
$ orb -m incus-test incus network create ws3b-br0
Network ws3b-br0 created          # type bridge, ipv4.address 10.107.184.1/24, nat true
                                  # distinct from incusbr0 (10.76.67.1/24)
```

## Step 3 — project's own profile with root disk + NIC on the new bridge

```
$ orb -m incus-test incus profile device add --project ws3b-contractors default root disk path=/ pool=local
Device root added to default       # later fixed: pool is named "default" on this daemon
$ orb -m incus-test incus profile device add --project ws3b-contractors default eth0 nic nictype=bridged parent=ws3b-br0
Device eth0 added to default
```

First launch failed with `Storage pool not found` (pool is named `default`, not `local`):

```
$ orb -m incus-test incus profile device set --project ws3b-contractors default root pool=default
```

## Step 4 — launch Alpine sandbox inside the project

```
$ orb -m incus-test incus launch images:alpine/3.22 ws3b-sandbox --project ws3b-contractors
Launching ws3b-sandbox             # image unpacked, container started
$ orb -m incus-test incus list --project ws3b-contractors
| ws3b-sandbox | RUNNING | 10.107.184.75 (eth0) | fd42:ea63:a5b6:227f:... (eth0) | CONTAINER | 0 |
$ orb -m incus-test incus exec --project ws3b-contractors ws3b-sandbox -- cat /etc/os-release | head -2
NAME="Alpine Linux"
ID=alpine
```

IP `10.107.184.75` ∈ ws3b-br0 subnet `10.107.184.0/24` (NOT incusbr0's `10.76.67.0/24`) ⇒ traffic rides the separate bridge.

## Isolation proofs

1. Instance invisible from default project:
```
$ orb -m incus-test incus list                       # default project
| ws2a-bulk | ... | ws2b-bulk | ...                  # only other runs' instances; NO ws3b-sandbox
$ orb -m incus-test incus config show ws3b-sandbox
Error: Failed to fetch instance "ws3b-sandbox" in project "default": Instance not found
```
2. Default-project network invisible from contractor project:
```
$ orb -m incus-test incus network show --project ws3b-contractors incusbr0
Error: Network not found
```
3. Separate bridge wiring (expanded devices of sandbox):
```
devices:
  eth0: {nictype: bridged, parent: ws3b-br0, type: nic}
  root: {path: /, pool: default, type: disk}
```
4. Project owns its profiles:
```
$ orb -m incus-test incus profile list --project ws3b-contractors
| default | Default Incus profile for project ws3b-contractors | USED BY 1 |
```

## Final state (left running, nothing cleaned)

- Project `ws3b-contractors` (features.profiles/networks/images = true)
- Bridge `ws3b-br0` (default-project-scoped managed bridge, 10.107.184.1/24, NAT on) — separate from `incusbr0`
- Profile `default` in project ws3b-contractors with root disk (pool=default) + eth0 → parent ws3b-br0
- Container `ws3b-sandbox`: RUNNING, Alpine 3.22, on 10.107.184.x
