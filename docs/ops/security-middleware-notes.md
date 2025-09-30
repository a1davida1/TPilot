# Security Middleware Notes

## Authentication Token Handling

- Bearer tokens are validated for structure before verification. Any token missing the three JWT segments or providing an empty value is rejected immediately with a `401` response.
- These malformed tokens are logged at the `warn` level to avoid polluting error monitoring. They are considered routine noise rather than exceptional failures.
- Valid-looking tokens continue through blacklist checks and verification; failures at that stage still trigger the standard invalid-token handling path.

Keep these semantics in mind when adding new authentication surfaces or when interpreting logs—`warn` entries for malformed tokens indicate the middleware is protecting the API from junk credentials.
