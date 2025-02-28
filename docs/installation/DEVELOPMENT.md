# Local Development

Apply example users to openldap so keycloak can use them later on.
Their default password is hashedpassword and their usernames are jsmith or sbrown
```shell
 ldapadd -x -H ldap://localhost -D "cn=admin,dc=dev,dc=local" -w admin -f .dev/people.ldif
```

