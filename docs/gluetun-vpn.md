## Adding Gluetun VPN in Docker Compose in Perplexica

This guide will help you integrate the Gluetun VPN container into your Perplexica setup, allowing you to securely route all your services through a VPN.

### Overview

Gluetun is a VPN client container that supports various VPN providers and advanced features like DNS over TLS, blocking malicious domains, and setting up firewall rules. In this setup, all services will run within the Gluetun network for enhanced security. So when you chat and search in Perplexica all your traffic is on a VPN.
### Prerequisites

- Docker and Docker Compose installed on your system.
- An existing Docker Compose file with your services. ( gluetun-docker-compose.yaml ) 
- VPN provider credentials. ( Your OpenVPN or Wireguard credentials ) 

### Steps to Integrate Gluetun

In the `VPN_SERVICE_PROVIDER`, add your actual VPN provider name and fill in the `OPENVPN_USER` and `OPENVPN_PASSWORD` with your credentials. For specific configuration details for your VPN provider, visit the Gluetun VPN Providers Setup. [Gluetun VPN Providers Page](https://github.com/qdm12/gluetun-wiki/tree/main/setup/providers)

See [Docker Secrets](https://github.com/qdm12/gluetun-wiki/blob/main/setup/advanced/docker-secrets.md) if you prefer instead of directly in yaml

* gluetun already takes care of unsetting sensitive environment variables after reading them at start
  
### Example of enviroment variables

Below is shown using OpenVPN with ProtonVPN

```yaml
environment:
      - VPN_SERVICE_PROVIDER=protonvpn
      - OPENVPN_USER=CV_hsSTDPuTaLpSkTf              # REPLACE WITH OPENVPN USER
      - OPENVPN_PASSWORD=BANSH65383HSBhIOSKN         # REPLACE WITH OPENVPN PASSWORD
      - SERVER_COUNTRIES=United States               # REPLACE WITH THE COUNTRY YOU WILL BE CONNECTING TO ON VPN see servers.json
      - SERVER_HOSTNAMES=node-us-188.protonvpn.net   # REPLACE WITH VPN HOSTNAME
      - TZ=America/Phoenix                           # TIMEZONE to have correct logs times ( your host timezone )
      - BLOCK_MALICIOUS=on                           # gluetun built in firewall options
      - BLOCK_SURVEILLANCE=on                        # gluetun built in firewall options
      - BLOCK_ADS=on                                 # gluetun built in firewall options
      - DOT=on                                       # gluetun firewall on/off  ( default is on )
      - FIREWALL_OUTBOUND_SUBNETS=192.168.1.0/24     # accessing ollama on your local network add your ollama host machine subnet
```

Advanced Options:

For configuring advanced options like firewall rules, DNS over TLS, HTTP proxying and more, refer to the Gluetun Advanced Setup. [Gluetun Advanced Setup](https://github.com/qdm12/gluetun-wiki/tree/main/setup#setup)

Deploy Your Services:

Run the following command to deploy your services with the Gluetun VPN:

```bash
docker compose -f gluetun-docker-compose.yaml up -d
```

If you make any changes to the `.yaml` file save and then run again with:

```bash
docker compose -f gluetun-docker-compose.yaml up -d --build
```

Portainer or Docker Desktop can easily see the Gluetun logs, or just use

```bash
docker logs <gluetun-container-id>
```

Remove containers and network stack

```bash
docker compose -f gluetun-docker-compose.yaml down
```

If using older version of docker compose you can try and run docker-compose instead ( might need to add `version: "3"` at the top of file for older versions )

### Notes

Ensure that the `Perplexica/gluetun` directory exists on your host and contains inside the necessary servers.json file. [You can also download the servers.json here](https://raw.githubusercontent.com/qdm12/gluetun/master/internal/storage/servers.json)
* Adjust the volume paths and network configurations as needed for your setup.
* The `servers.json` is a huge list of all the VPN providers in the gluetun folder.
* Ports are all listed under Gluetun container for Perplexica. Perplexica and SearXNG only need `network_mode: 'service:gluetun'`

By following these steps, you'll have Gluetun VPN integrated into Perplexica, securing your services with VPN and advanced network configurations. You should be able to go to the port :4000 for searxng and search "whats my ip" to see the VPN IP address.

Youtube video showing how to setup Gluetun on it's own but you can understand the options
[https://www.youtube.com/watch?v=0F6I03LQcI4](https://www.youtube.com/watch?v=0F6I03LQcI4)


### Troubleshooting

Container won't start or crashes! - Verify your VPN provider and the environment vaules in the yaml is correct for your provider, the example only shows Proton and different VPN providers might require additional environment vaules. See here for all providers [Gluetun VPN Providers List](https://github.com/qdm12/gluetun-wiki/tree/main/setup/providers)

Can't access ollama! - Check to see if you need to add your IP subnet of your ollama host and other machines connecting to port 3000 to the `FIREWALL_OUTBOUND_SUBNETS` or other specific vaules needed for your VPN provider.

If your still having issues try and start a stand alone Gluetun VPN container outside of Perplexica first and connect to it via HTTP proxy to make sure your set up is correct. [Gluetun Github Repo](https://github.com/qdm12/gluetun)

