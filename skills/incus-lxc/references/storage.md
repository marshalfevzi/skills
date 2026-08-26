# Storage: pools, volumes, backups

Covers pools (create/configure/resize/delete), volume types, attaching custom volumes, moving/copying/exporting them, and buckets.
Root-disk devices and profiles live in [instances.md](instances.md) and [images-profiles.md](images-profiles.md).

## Pools

A pool is the backing store for everything Incus keeps: instance root disks, images,
custom volumes, buckets. `admin init` created one already (usually `default`);
add more whenever you want data separated by speed, lifetime, or driver.

```bash
incus storage list                      # what exists
incus storage create <pool> <driver> [key=value ...]
incus storage show <pool>               # full configuration
incus storage info <pool>               # usage numbers
incus storage set <pool> <key>=<value>  # or: incus storage edit <pool>
incus storage delete <pool>             # destructive: confirm with the human first
```

With no `source=`, Incus creates a loop-backed pool sized to 20% of free disk space
(clamped to 5–30 GiB). Loop files live in `/var/lib/incus/disks/`, grow up to the
limit but never shrink when instances are deleted — treat the `size` key as a
high-water mark. Point `source=` at an existing directory (`dir`), Btrfs filesystem,
zpool/dataset, LVM volume group, or block device; dedicated disks outperform loop
files because every write skips the host filesystem's journaling layer.

### Choosing a driver

| | `dir` | `btrfs` | `zfs` |
| --- | --- | --- | --- |
| Works anywhere | yes — plain directories | needs `btrfs-progs` + kernel support | needs `zfsutils-linux` + kernel module |
| Copy-on-write / instant clone & snapshot | no (full data copies) | yes | yes |
| Optimized image storage & instance creation | no | yes | yes |
| Optimized volume transfer (send/receive) | no | yes | yes |
| Restore from non-latest snapshot | yes | yes | no — latest only |
| Quotas | ext4/XFS with project quotas only | yes, but escapable via nested subvolumes | yes (`refquota` option) |

Pick in this order: **ZFS** when available (most reliable of the two COW options),
**Btrfs** otherwise (avoid it for VMs — qgroup accounting on raw disk-image files hits
quotas spuriously), **`dir`** as the always-works fallback for tests and throwaway
environments. `dir` supports every main feature, so nothing breaks — it is just slow,
because every launch copies the full image. Other drivers (`lvm`, `ceph*`,
`lvmcluster`, `linstor`, `truenas`) serve shared-block or clustered setups.

ZFS restores refuse anything but the newest snapshot. To land on an older one, either
delete the newer snapshots so the target becomes latest, or set
`zfs.remove_snapshots=true` on the volume to let Incus discard them during restore.

## Launching onto a chosen pool

An instance's root disk lands in whatever pool its profile's `root` device names.
Three ways to redirect it, most explicit first:

```bash
incus launch images:debian/12 bulk --storage fastdata     # one-off override
incus profile device add <profile> root disk path=/ pool=fastdata   # per-profile
incus config device override web root pool=fastdata       # per-instance, inherited device
```

There is no server-wide default pool: without any of these, the default profile's
`root` device wins.

## Volumes

Every instance gets an automatically managed root volume; `image` volumes are cached
unpacked images (auto-deleted ten days after last use). The kind you manage yourself
is the **custom** volume — independent of any instance, retained until explicitly
deleted, shareable between instances.

Volume types and how to name them in commands:

| Type | Created by | Name form in commands |
| --- | --- | --- |
| `container` / `virtual-machine` | launch/init | `<type>/<name>` — e.g. `container/web` |
| `image` | image unpacking | `image/<fingerprint-or-alias>` |
| `custom` | you | bare name (default type) |
| `bucket` | you | separate `storage bucket` commands |

Content types constrain attachment: `filesystem` volumes (the default) attach to both
containers and VMs; `block` volumes attach only to VMs, and to exactly one VM at a
time because concurrent writers corrupt the data; `iso` volumes attach read-only to
any number of VMs.

### Create, attach, configure

```bash
incus storage volume create fastdata extras size=1GiB           # custom, filesystem content
incus storage volume create fastdata rawdisk --type=block       # VM-only block volume
incus storage volume import fastdata installer.iso iso-vol --type=iso

# Attach — shortcut form (creates the disk device for you):
incus storage volume attach fastdata extras bulk /mnt/extras    # path = mountpoint inside
incus storage volume attach fastdata rawdisk bulk               # block: no path

# Attach — explicit device form, needed when adding options:
incus config device add bulk extras disk pool=fastdata source=extras \
  path=/mnt/extras readonly=true limits.max=50MiB,200iops
```

Useful device properties beyond `path=`/`readonly=`/`size=`: `limits.read`,
`limits.write`, `limits.max` cap I/O in byte/s and/or IOPS (comma-separated), applied
per physical disk through the blkio controller — so limits blur when two devices share
one disk. Burst knobs (`limits.*.burst` plus `*.burst.length`) exist for VMs only.

Pool-level defaults apply to new volumes until overridden per-volume:
`incus storage set fastdata volume.size=5GiB`.

Inspect with `incus storage volume list <pool>` (`--all-projects` across projects),
`volume show`, and `volume info`; configure via
`incus storage volume set <pool> [<type>/]<name> key=value`.

### Grow volumes and pools

Growing usually works while space remains in the pool; shrinking rarely does and never
below used space — provision generously up front rather than planning to shrink later.

```bash
incus storage volume set fastdata extras size=2GiB      # grow a custom volume
incus config device set web root size=10GiB             # grow an instance root disk
incus storage set fastdata size=50GiB                   # grow a loop-backed pool
```

For `virtual-machine/*` volumes, resize the root device (second command) — direct
volume resizing does not apply there. Pool growth works only for Incus-managed
(loop-backed) pools, never for a fixed-disk source.

## Moving, copying, exporting

```bash
# Copy within or between pools (same pool requires different names):
incus storage volume copy fastdata/extras archive/extras-copy
# Move/rename — stop every attached instance first:
incus storage volume move fastdata/extras archive/extras
# Relocate a whole instance's root volume to another pool:
incus stop bulk && incus move bulk --storage archive
```

Cross-pool moves convert between drivers automatically. Add remote prefixes
(`src:`/`dst:`) to copy between servers; cluster members need `--target` +
`--destination-target`, other projects `--target-project`. `--refresh` updates an
existing copy incrementally — fastest when the copy carries periodic snapshots and both
pools run btrfs/ZFS, where native send/receive transfers just the delta.

### Volume snapshots

Snapshots live in the same pool as the volume — quick and cheap on btrfs/ZFS, slow on
`dir` (it tars the data). For durability beyond the pool, export instead.

```bash
incus storage volume snapshot create fastdata extras clean
incus storage volume info fastdata extras                    # lists snapshots
incus storage volume snapshot restore fastdata extras clean  # stop attached instances first
incus storage volume snapshot delete fastdata extras clean

# Scheduled snapshots with expiry:
incus storage volume set fastdata extras snapshots.schedule=@daily \
  snapshots.expiry=7d snapshots.pattern=auto-%d
```

Restore into a new volume with the copy syntax:

`incus storage volume copy fastdata/extras/clean archive/extras-restored` (ZFS: latest
snapshot only).

### Export files

Export produces a standalone tarball you can stash off-box — more reliable than
same-pool snapshots, and restorable into any pool regardless of driver.

```bash
incus storage volume export fastdata extras /backup/extras.tgz
incus storage volume import archive /backup/extras.tgz extras-restored
```

Flags worth knowing: `--compression=bzip2|none|…`; `--volume-only` skips snapshots
(default exports include them); `--optimized-storage` writes a driver-native blob on
btrfs/ZFS — faster and smaller, but restorable only onto the same driver. Export
overwrites an existing target file silently.

Custom volumes are not covered by instance backups and survive instance deletion —
back them up separately, using this section.

## Buckets

Buckets expose S3-compatible object storage; applications reach them over HTTP rather
than through mounts. Supported on `dir`, `btrfs`, `lvm`, and `zfs` pools once the
server has an S3 address:

```bash
incus config set core.storage_buckets_address=:8555
incus storage bucket create fastdata assets
incus storage bucket key create fastdata assets deploy-key --role=admin   # prints access+secret keys
incus storage bucket list fastdata
```

Roles: `admin` (full access) or `read-only` (default). Set a quota with
`incus storage bucket set <pool> <bucket> size=<n>` — growable, never shrinkable
below use. In clusters, local-pool buckets stay pinned to their member;
`cephobject` pools give S3 reachable from every member.
