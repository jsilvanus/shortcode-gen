# Account, Link Visibility and Site Settings

## Accounts

Shortcode Gen has two account roles:

- `USER`: normal account
- `ADMIN`: administrator account

### User permissions

A user can:

- create links owned by themselves;
- edit their own links;
- delete/deactivate their own links;
- view their own links;
- view links owned by other users when those links are marked non-private.

A user cannot edit another user's link merely because it is non-private.

### Admin permissions

An administrator can:

- view all links, including private links;
- create and edit links;
- edit any user's link;
- deactivate/delete links;
- manage users;
- manage site settings.

## Link visibility

Every link has an `isPrivate` flag.

- `private = true`: visible in management UI only to the owner and administrators.
- `private = false`: visible to the owner, administrators, and other authenticated users.

Visibility is an authorization concern and must be enforced server-side, not only by hiding UI elements.

Public/non-private visibility does **not** grant edit permission. Only the owner and administrators can modify a link.

The short URL itself remains usable according to its normal active/expiration rules regardless of the management visibility flag.

## Site settings

Administrators can manage site-wide settings through the admin UI.

Settings are stored in the database as key/value settings rather than being baked into environment variables when they are intended to be changed from the UI.

Initial setting:

### Allowed short-link target domains

The administrator can configure which target domains may be used when creating links.

Example:

```text
example.com
www.example.org
*.mydomain.fi
```

The setting applies to link creation and editing and is validated server-side.

Domain matching should be normalized and case-insensitive. A configured domain matches itself and its subdomains only when explicitly allowed by the configured semantics.

This is separate from SSRF protection: **an allowed domain is not automatically safe to fetch**. Every outbound request still passes the SSRF/IP/network safety checks.

## Site settings UI

Admin UI should provide:

- settings page
- list of configurable settings
- clear description of each setting
- validation errors
- save/cancel controls
- confirmation that changes were saved

Only administrators can access or modify the settings API.

## Data model

`User` contains:

```text
id
username
passwordHash
role
createdAt
updatedAt
```

`ShortLink` contains:

```text
ownerId
isPrivate
```

`SiteSetting` contains:

```text
key
value
updatedAt
```

## Implementation phases affected

### Authentication/admin

Implement role-aware sessions and authorization.

### Link management

Implement ownership and privacy filtering in every link query and mutation.

### Site settings

Add administrator-only settings UI/API and domain allow-list validation.

### Testing

Test at minimum:

- user can create a link;
- user can edit own link;
- user cannot edit another user's link;
- user can see another user's non-private link;
- user cannot see another user's private link;
- admin can see and edit all links;
- non-admin cannot modify site settings;
- admin can modify site settings;
- domain allow-list applies to create and edit;
- SSRF protection still applies to an allowed domain.
