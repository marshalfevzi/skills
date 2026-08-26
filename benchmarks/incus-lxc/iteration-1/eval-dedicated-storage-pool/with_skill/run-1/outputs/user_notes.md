# Run ws2a — eval-dedicated-storage-pool / with_skill / run-1

## Uncertainties & observations

- **Volume size not enforced**: requested 1 GiB, but `df -h /mnt/extras` inside the
  container shows 134G free. Cause: pool driver is `dir` (only feasible driver in this
  OrbStack VM — no ZFS/Btrfs tools installed), and per upstream docs `dir` supports no
  copy-on-write and only ext4/XFS *project* quotas, which are not enabled here. The
  `size=1GiB` is correctly recorded in the volume/device config; it just isn't enforced.
  A btrfs/zfs pool would honor it.
- Name mapping applied per collision token `ws2a-`: `fastdata` → `ws2a-fastdata`,
  `bulk` → `ws2a-bulk`, `extras` → `ws2a-extras`.
- Sibling run's objects (`ws2b-fastdata`, `ws2b-bulk`) visible in shared daemon — no
  collisions; all commands operated on default project.
