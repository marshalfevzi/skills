# Transcript — eval-dedicated-storage-pool, with_skill, run-1 (token `ws2a-`)

Name mapping: `fastdata` → `ws2a-fastdata`, `bulk` → `ws2a-bulk`, `extras` → `ws2a-extras`.

Followed `skills/incus-lxc/SKILL.md`: daemon-reach check → routed storage task to
`references/storage.md`. Driver choice per reference table: no ZFS/Btrfs in the VM, so
the "always works" fallback `dir`.

## 0. Reach the daemon (skill step 1)

```
$ orb -m incus-test incus version
Client version: 6.0.0
Server version: 6.0.0
$ orb -m incus-test incus list
| ws2b-bulk | RUNNING | 10.76.67.18 ... | CONTAINER |   <- sibling run's instance; daemon reachable
$ orb -m incus-test incus storage list
| default       | dir | /var/lib/incus/storage-pools/default       | CREATED |
| ws2b-fastdata | dir | /var/lib/incus/storage-pools/ws2b-fastdata | CREATED |
```

## 1. Create pool `ws2a-fastdata`

```
$ orb -m incus-test incus storage create ws2a-fastdata dir
Storage pool ws2a-fastdata created
$ orb -m incus-test incus storage list
| ws2a-fastdata | dir | /var/lib/incus/storage-pools/ws2a-fastdata | USED BY 0 | CREATED |
```
Verified: pool exists.

## 2. Launch Debian container with root disk on that pool

Reference recipe: `incus launch images:debian/12 bulk --storage fastdata` (one-off override).

```
$ orb -m incus-test incus launch images:debian/12 ws2a-bulk --storage ws2a-fastdata
Launching ws2a-bulk
Retrieving image: Unpack: 100% (2.98GB/s)
$ orb -m incus-test incus list
| ws2a-bulk | RUNNING | 10.76.67.130 (eth0) | CONTAINER | 0 |
$ orb -m incus-test incus config show ws2a-bulk
devices:
  root:
    path: /
    pool: ws2a-fastdata      <- root disk on requested pool
    type: disk
```
Verified: RUNNING + root device `pool=ws2a-fastdata`.

## 3. Create and attach extra 1 GiB volume

Reference recipes:
`incus storage volume create <pool> <name> size=1GiB` then
`incus storage volume attach <pool> <name> <inst> /mnt/extras`.

```
$ orb -m incus-test incus storage volume create ws2a-fastdata ws2a-extras size=1GiB
Storage volume ws2a-extras created
$ orb -m incus-test incus storage volume attach ws2a-fastdata ws2a-extras ws2a-bulk /mnt/extras
(no output = success)
$ orb -m incus-test incus storage volume list ws2a-fastdata
| container | ws2a-bulk   | filesystem | USED BY 1 |
| custom    | ws2a-extras | filesystem | USED BY 1 |
$ orb -m incus-test incus config show ws2a-bulk   # devices section
devices:
  root:
    path: /
    pool: ws2a-fastdata
    type: disk
  ws2a-extras:
    path: /mnt/extras
    pool: ws2a-fastdata
    source: ws2a-extras
    type: disk
$ orb -m incus-test incus exec ws2a-bulk -- df -h /mnt/extras
/dev/vdb1       134G   53G   82G  40% /mnt/extras
$ orb -m incus-test incus exec ws2a-bulk -- sh -c 'echo written-inside > /mnt/extras/probe.txt && cat /mnt/extras/probe.txt'
written-inside
```
Verified: volume attached as disk device, mounted inside container, writable.
Note: `df` shows 134G — `dir` driver does not enforce volume sizes on ext4 without
project quotas (see user_notes.md); `size=1GiB` is recorded config only.

## 4. Final config display

Saved to `final_config.txt`: `storage list`, `storage show ws2a-fastdata`,
`volume list` + `volume show ws2a-fastdata ws2a-extras`, `config show ws2a-bulk`,
instance list.

## End state (left running/in place per rules)

- Pool `ws2a-fastdata` (dir) — CREATED
- Container `ws2a-bulk` — RUNNING, root on `ws2a-fastdata`
- Custom volume `ws2a-extras` (size=1GiB) — attached at `/mnt/extras`
