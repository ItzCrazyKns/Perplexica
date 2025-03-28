### Adding auth0
* use `yard add` for new packages and the packages will be updated automatically
* auth-secret generate with `openssl rand -hex 32`
* need to no-cache if updating packages...don't need to remove `--frozen-lockfile` can be handled with `yarn`
* version 2 is using 

### Adding userID to the schema
* complaining about userID column not existing find a way to reset the database within the docker container