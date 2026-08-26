Connect instances to networks: managed bridges, NIC types, port forwards,
ACLs, bandwidth, DNS/firewall interplay, OVN, and IPAM. Instance device
workflows and proxy devices live in [instances.md](instances.md).

## Managed networks

A *managed* network is one Incus creates and controls end to end: it makes the
interface, runs DHCP/DNS on it (`dnsmasq`), and NATs outbound traffic by
default. Prefer managed networks over hand-built `nictype=` devices — the NIC
inherits every setting, and features like forwards and ACLs only work here.

Create a bridge with explicit addressing (omit `--type` to get a bridge):

```bash
incus network create appbr0 \
    ipv4.address=10.10.0.1/24 ipv6.address=fd42:app::1/64 \
    ipv4.dhcp.ranges=10.10.0.100-10.10.0.200
incus network show appbr0          # inspect effective config
incus network set appbr0 ipv4.nat=true
incus network unset appbr0 ipv6.nat
```

Useful bridge keys beyond the addresses: `ipv4.nat`, `ipv{n}.dhcp`,
`ipv{n}.routes`, `dns.domain` (default `incus`), `dns.mode`
(`managed`/`dynamic` enables per-instance name resolution),
`bridge.external_interfaces` (extra interfaces pulled onto the bridge;
`name/parent/vlan` creates missing VLANs automatically). IPv6 prefixes smaller
than /64 break `dnsmasq`; use /64, or static allocation.

Attach it to an instance as a NIC device:

```bash
incus network attach appbr0 webapp eth0      # name the device explicitly
incus config device add webapp eth0 nic network=appbr0   # equivalent form
```

Name the device `eth0` deliberately: cloud images auto-configure `eth0`, so an
auto-generated device name leaves the instance without networking. On a
cluster, first run `create … --target=<member>` per member, then once more
without `--target` to finalize — members may need different `parent=` values.

## NIC types

Two ways to specify a NIC: `network=<managed-network>` (Incus derives the type
and inherits its settings) or `nictype=<type>` plus everything Incus would
otherwise know (e.g. `parent=br0`). They are mutually exclusive.

| `nictype` | Containers | VMs | Pick when |
| --- | --- | --- | --- |
| `bridged` | yes | yes | Default choice. Connects to a bridge; with a managed bridge you get DHCP/DNS/NAT, forwards, ACLs, zones. |
| `macvlan` | yes | yes | You want near-line-rate LAN access without bridge overhead. Host and instance cannot talk directly; no Incus services (DHCP comes from outside). |
| `routed` | yes | yes | Instance should sit on the parent's subnet without a bridge. Static routes + proxy ARP/NDP; unlike macvlan, host↔instance works. IPs are static (`ipv4.address`). |
| `p2p` | yes | yes | You want a bare veth pair to wire up yourself (routing, firewalls). No IP management at all. |
| `physical` | yes | yes | The instance should own a whole host NIC. The device vanishes from the host; one NIC per device. |
| `sriov` | yes | yes | Hardware-accelerated passthrough of a virtual function on an SR-IOV-capable NIC. Near-native performance, limited guest configurability. |
| `ovn` | yes | yes | Multi-tenant SDN. Only usable via `network=<ovn-network>`. |
| `ipvlan` | containers | no | Same MAC, different IPs on a parent. No hotplug; DNS must be configured inside the container manually. |

NICs hotplug on both containers and VMs, except `ipvlan`. Throttle any NIC
with `limits.ingress`/`limits.egress` (or `limits.max`), values in mbit, e.g.
`incus config device set webapp eth0 limits.egress=100`.

For high-throughput hosts also raise the transmit queue length on both the
physical NIC and the bridge (e.g. `ip link set eth0 txqueuelen 10000`) and
`net.core.netdev_max_backlog` in `/etc/sysctl.conf`; match inside instances
via the `queue.tx.length` NIC option.

## Port forwards

Available on bridges and OVN networks. A forward maps ports on one external
listen address into the network's subnet — share a single public IP across
several instances:

```bash
# Everything unmatched goes to one instance (must be inside the subnet):
incus network forward create appbr0 203.0.113.50 target_address=10.10.0.5
incus network forward port add appbr0 203.0.113.50 tcp 8080 10.10.0.7 80
incus network forward port add appbr0 203.0.113.50 tcp 9090-9100 10.10.0.8
incus network forward list appbr0
incus network forward edit appbr0 203.0.113.50     # YAML view · delete likewise
```

A single listen port maps to one target port; equal-length lists map
positionally. On bridges with the `nftables` driver, `snat=true` on a port
rewrites return traffic so external clients always see the listen address —
keep each target port covered by exactly one forward when using it.

On OVN (and load balancers), listen addresses must fall inside the uplink's
`ipv{n}.routes` or a project's `restricted.networks.subnets`.

## Network ACLs

ACLs filter traffic per NIC or for every NIC on a network. Assign them by
adding names to `security.acls`:

```bash
incus network acl create web-acl description="allow https in"
incus network acl rule add web-acl ingress action=allow protocol=tcp destination_port=443
incus network acl rule add web-acl egress action=allow destination=10.10.0.0/24
incus network acl rule remove web-acl ingress action=allow protocol=tcp destination_port=443
incus network set appbr0 security.acls=web-acl                 # network-wide
incus config device set webapp eth0 security.acls=web-acl      # single NIC
```

Rule fields: `action` (`allow`, `allow-stateless`, `reject`, `drop`),
`source`/`destination` (CIDR or IP ranges), `protocol` (`tcp`, `udp`,
`icmp4`, `icmp6`), `source_port`/`destination_port`, `icmp_type`/`icmp_code`,
`state` (`enabled`, `disabled`, `logged`).

List position is irrelevant — Incus sorts by action: `drop`, then `reject`,
then `allow`, then the default. Applying any ACL to a NIC adds a default
**reject** for unmatched traffic; change it per direction with
`security.acls.default.{ingress,egress}.action` (set on the network or the
NIC, NIC wins):

```bash
incus network set appbr0 security.acls.default.ingress.action=allow
```

Debug rules before enforcing them: create copies with `state=logged`, then
read hits with `incus network acl show-log <acl>`.

Bridge limitations worth knowing: bridge ACLs act only where the bridge meets
the host, so they cannot firewall instance-to-instance traffic on the same
bridge — apply the ACL directly to each NIC device for that. ACL groups and
network selectors (`@internal`, `@external`, peer selectors) exist only on
OVN.

### Address sets

Group addresses once, reference everywhere. Works on OVN and on bridges with
`nftables`. In ACL rules, prefix the name with `$` (shell-quote it):

```bash
incus network address-set create partners
incus network address-set add partners 198.51.100.0/24 203.0.113.20-203.0.113.40
incus network acl rule add web-acl ingress "action=allow" "source=\$partners"
```

Sets accept mixed IPv4/IPv6 addresses, CIDRs, and ranges (a range expands to
at most 256 addresses; use CIDR above that).

## DNS

Two distinct layers, often needed together:

### Zones (serve instance records)

Network zones generate forward and reverse records for every instance, then
hand the zone to your production DNS servers. Enable the built-in server, pick
zones, attach them to the network:

```bash
incus config set core.dns_address=<ip>:1053        # avoid port 53
incus network zone create incus.example.net        # forward records
incus network zone create 2.0.192.in-addr.arpa     # IPv4 reverse
incus network set appbr0 dns.zone.forward=incus.example.net
incus network set appbr0 dns.zone.reverse.ipv4=2.0.192.in-addr.arpa
```

The built-in server speaks AXFR only — pair it with `bind9`/`nsd`, authorize
the secondary with `incus network zone set <zone> peers.<name>.address=<secondary-ip>`
(leave that peer's `key` unset for plain address matching, or supply a TSIG
key named `<zone>_<peer>.`). Add manual records with `incus network zone
record entry add <zone> <record> A 1.2.3.4 [--ttl N]`. Zones must be globally
unique across projects.

### systemd-resolved on the host

So the host itself resolves `<instance>.<dns.domain>` through the bridge's DNS
(`dns.mode` must be `managed` or `dynamic`):

```bash
resolvectl dns incusbr0 "$(incus network get incusbr0 ipv4.address | cut -d/ -f1)"
resolvectl domain incusbr0 '~'"$(incus network get incusbr0 dns.domain || echo incus)"
resolvectl dnssec incusbr0 off       # Incus DNS supports neither DNSSEC nor DoT
resolvectl dnsovertls incusbr0 off
resolvectl status incusbr0           # verify: DNS Servers + DNS Domain lines
```

The `~` routes only that domain to this resolver, keeping other lookups on the
default path. These settings vanish on reboot and daemon restart; persist them
by binding a small oneshot unit to the bridge device
(`/etc/systemd/system/incus-dns-incusbr0.service` with
`BindsTo=sys-subsystem-net-devices-incusbr0.device` and one `ExecStart=/usr/bin/resolvectl …`
per line above) and enabling it.

## Firewall interference

Incus and host firewalls share netfilter, and a block in any namespace wins —
your firewall can silently break DHCP, DNS, and forwarding even though Incus
keeps its rules in a separate nftables table. If you run another firewall,
turn Incus' own rules off (`incus network set <bridge> ipv4.firewall=false
ipv6.firewall=false`) and open the bridge explicitly:

- firewalld: `sudo firewall-cmd --zone=trusted --change-interface=<bridge> --permanent && sudo firewall-cmd --reload`
- UFW: `sudo ufw allow in on <bridge>` plus
  `sudo ufw route allow in/out on <bridge>`; with a default-deny policy, also
  allow UDP 67/547 and port 53 inbound, and forwarded traffic from the bridge's
  subnets.

Docker deserves special care: setting the global FORWARD policy to drop cuts
every instance off. Persist `net.ipv4.conf.all.forwarding=1` in
`/etc/sysctl.d/` before Docker starts, or set `"ip-forward-no-drop": true` in
`daemon.json`, or add ACCEPT rules in the `DOCKER-USER` chain for the bridge.

## OVN

OVN adds software-defined logical networks: many isolated subnets over one
shared uplink, with full ACL semantics (groups, selectors), load balancers,
peering, and cross-deployment integrations. Reach for it in multi-tenant or
cluster settings; on a single box a bridge is simpler. It needs extra
infrastructure (Open vSwitch, OVN central DB), which is why this stays brief.

Standalone outline against a managed bridge uplink:

```bash
sudo apt install ovn-host ovn-central
sudo ovs-vsctl set open_vswitch . \
    external_ids:ovn-remote=unix:/run/ovn/ovnsb_db.sock \
    external_ids:ovn-encap-type=geneve external_ids:ovn-encap-ip=127.0.0.1
incus network set incusbr0 ipv4.ovn.ranges=10.65.10.100-10.65.10.200
incus network create ovsnet --type=ovn network=incusbr0
```

Peer two OVN networks so their traffic skips the uplink entirely — the
relationship is mutual, and a typo'd target stays pending rather than erroring
(so check `status=created`):

```bash
incus network peer create net1 link net2
incus network peer create net2 link net1
incus network peer list net1
```

`--type=remote` with an integration (`incus network integration create <name>
ovn`, then point `ovn.northbound_connection`/`southbound_connection` at remote
OVN IC databases) extends peering across deployments. OVN load balancers
mirror forward syntax (`incus network load-balancer create <net> <listen-ip>`,
then `backend add` and `port add`) but spread traffic over several backends.

## IPAM debugging

`incus network list-allocations [--project P | --all-projects]` prints every
allocated address — networks, instances, forwards, load balancers — with the
owning URI and NAT flag. Use it to find who holds an address or where a
subnet's space went before changing allocations.

Deleting a network drops its instances' connectivity immediately; confirm with
the human first (see SKILL.md's destructive-action gate).
