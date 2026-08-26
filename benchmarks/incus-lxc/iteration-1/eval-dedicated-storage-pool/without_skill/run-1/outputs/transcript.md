# Run: eval-dedicated-storage-pool / without_skill / run-1

- Collision token: `ws2b-` (prefix for all created names)
- Name mapping: fastdata → `ws2b-fastdata`, bulk → `ws2b-bulk`, extras → `ws2b-extras`
- Entrypoint: every command run as `orb -m incus-test <cmd>`

## Step 0 — environment check

```
$ orb -m incus-test incus --version
6.0.0
$ orb -m incus-test incus storage list
| NAME    | DRIVER | SOURCE                               | USED BY | STATE   |
| default | dir    | /var/lib/incus/storage-pools/default | 1       | CREATED |
```

## Step 1 — create storage pool `ws2b-fastdata`

```
$ orb -m incus-test incus storage create ws2b-fastdata dir
Storage pool ws2b-fastdata created
$ orb -m incus-test incus storage show ws2b-fastdata
config:
  source: /var/lib/incus/storage-pools/ws2b-fastdata
name: ws2b-fastdata
driver: dir
used_by: []
status: Created
locations:
- none
```

Verified: pool exists, status Created.

## Step 2 — launch Debian container `ws2b-bulk` with root disk on the pool

```
$ orb -m incus-test incus launch images:debian/12 ws2b-bulk --storage ws2b-fastdata
Launching ws2b-bulk
Retrieving image: Unpack: 100% (1.78GB/s)
$ orb -m incus-test incus list ws2b-bulk
| NAME       | STATE   | IPV4               | TYPE      |
| ws2b-bulk  | RUNNING | 10.76.67.18 (eth0) | CONTAINER |
$ orb -m incus-test incus config show ws2b-bulk --expanded   (devices section)
devices:
  root:
    path: /
    pool: ws2b-fastdata
    type: disk
```

Verified: container RUNNING; root device `pool: ws2b-fastdata`.

## Step 3 — create and attach 1 GiB volume `ws2b-extras`

```
$ orb -m incus-test incus storage volume create ws2b-fastdata ws2b-extras size=1GiB
Storage volume ws2b-extras created
$ orb -m incus-test incus storage volume attach ws2b-fastdata ws2b-extras ws2b-bulk
Error: Failed add validation for device "ws2b-extras": Custom filesystem volumes require a path to be defined
```

Retry with an explicit mount path:

```
$ orb -m incus-test incus storage volume attach ws2b-fastdata ws2b-extras ws2b-bulk /mnt/extras
(ok)
$ orb -m incus-test incus exec ws2b-bulk -- sh -c 'df -h /mnt/extras'
/dev/vdb1  134G  54G  81G  40% /mnt/extras
```

Verified: disk device `ws2b-extras` present in container config; mounted at `/mnt/extras` inside the container.

## Step 4 — resulting config

Full display saved to `final_config.txt` (pool show + volume list + `incus config show ws2b-bulk`). Key devices section:

```yaml
devices:
  root:
    path: /
    pool: ws2b-fastdata
    type: disk
  ws2b-extras:
    path: /mnt/extras
    pool: ws2b-fastdata
    source: ws2b-extras
    type: disk
```

## Final state (left in place, RUNNING)

- Pool `ws2b-fastdata` (dir driver) — CREATED
- Container `ws2b-bulk` — RUNNING, root on `ws2b-fastdata`
- Custom volume `ws2b-extras` (size=1GiB in config) attached at `/mnt/extras`
