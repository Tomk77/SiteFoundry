# Personal settings

- Status: Working specification
- Owner: Unassigned
- Created: 2026-07-13
- Last updated: 2026-07-13
- Related specifications: Authentication and sessions, permissions, admin information architecture

## 1. Summary

Personal settings let an authenticated user manage their own identity, sign-in credentials, interface language, and visual theme. These preferences belong to the user and apply across Scaffold CMS rather than to one website or language tree.

Personal settings are separate from site-wide settings. Site-wide settings configure a selected website and will be covered by a dedicated specification.

## 2. Goals

- Provide a clear route from the lower-left user card to personal settings.
- Let users maintain their first name, last name, email address, and username or display name.
- Let eligible users change their password safely.
- Let users choose their interface language and visual mode.
- Keep personal preferences consistent across every website the user can access.

## 3. Non-goals

- Website name, domains, content languages, integrations, publishing defaults, or other site-wide configuration.
- Site membership, role, or permission management.
- Public author profiles or profile fields exposed through content APIs.
- Avatar upload in the initial scope.
- Account deletion, data export, multi-factor authentication, passkeys, and active-session management.
- Translation management for website content.

## 4. Users and permissions

- Every authenticated user may view and update their own personal settings.
- A user must never view or edit another user's settings through this screen or its underlying API.
- Site roles do not affect access to personal settings.
- Password controls are available only when the authentication method supports password credentials.
- Sensitive identity changes may require recent authentication.

## 5. Terminology

- **Personal settings:** Account-scoped settings that follow the user across accessible websites.
- **Site-wide settings:** Settings belonging to one selected website and outside this specification.
- **Interface language:** The language of the Scaffold CMS administration interface. It does not change content language.
- **Interface mode:** System preference, light, or dark appearance for the administration interface.
- **Username:** A user-controlled identifier or display label distinct from email. Its exact role remains open.

## 6. User journeys

### Journey: Open personal settings

1. The user sees their card at the bottom of the left navigation.
2. The user activates it with pointer or keyboard.
3. Scaffold CMS either opens an account menu with a Personal settings action or navigates directly to Personal settings.
4. The screen opens without changing the selected website.

### Journey: Update profile information

1. Scaffold CMS loads the current first name, last name, email, and username or display name.
2. The user edits one or more fields and saves.
3. Scaffold CMS validates and persists the values.
4. The user card and visible account labels update without requiring a new sign-in.

### Journey: Change password

1. A password-authenticated user enters their current password, a new password, and confirmation.
2. Scaffold CMS validates the current credential and password policy.
3. Scaffold CMS changes the password and confirms success without exposing any credential value.

### Journey: Change interface preferences

1. The user selects an interface language and interface mode.
2. Scaffold CMS applies the selected language and theme.
3. Preferences persist across reloads, sign-ins, websites, and supported devices.

## 7. Functional requirements

### Navigation and scope

- **PSET-001:** The lower-left user card must provide an obvious route to Personal settings.
- **PSET-002:** Personal settings must be visually and structurally distinct from site-wide settings.
- **PSET-003:** Opening or saving Personal settings must not change the selected website or content language.
- **PSET-004:** Personal settings must remain available regardless of the user's site role.

### Profile

- **PSET-010:** Profile must contain First name, Last name, Email, and Username or display name.
- **PSET-011:** First name and email are required.
- **PSET-012:** Last name may be empty unless a later identity policy makes it required.
- **PSET-013:** Email must be syntactically valid and normalized before comparison or storage.
- **PSET-014:** The screen must explain when an email change requires confirmation.
- **PSET-015:** Saved profile changes must update the user card and account labels without a new sign-in.
- **PSET-016:** Unsaved changes must be visibly distinguishable from saved values.
- **PSET-017:** Save must be disabled when nothing changed or while saving.

### Password

- **PSET-020:** Change password must contain Current password, New password, and Confirm new password.
- **PSET-021:** Each password field must support an accessible show or hide control.
- **PSET-022:** New password and confirmation must match before submission.
- **PSET-023:** The new password must satisfy the configured password policy.
- **PSET-024:** Passwords must never be prefilled from stored data, logged, returned by an API, or stored as profile metadata.
- **PSET-025:** A successful password change must produce clear confirmation.
- **PSET-026:** Incorrect current password, expired session, provider limitation, and policy failures require specific actionable errors.
- **PSET-027:** Provider-only accounts must hide the password form or replace it with provider-appropriate guidance.

### Experience

- **PSET-030:** Experience must contain Interface language and Interface mode controls.
- **PSET-031:** Interface language lists every administration translation available in the installation.
- **PSET-032:** Interface language affects only the current user's administration interface.
- **PSET-033:** Interface language must not change website locale, content language, or translation relationships.
- **PSET-034:** Interface mode offers System preference, Light, and Dark.
- **PSET-035:** System preference follows the operating system and reacts when it changes.
- **PSET-036:** Explicit Light or Dark selection overrides the operating-system preference.
- **PSET-037:** The saved theme should apply before the authenticated interface becomes visible to avoid a theme flash.
- **PSET-038:** Interface preferences follow the user across websites in the installation.

### Saving and feedback

- **PSET-040:** Profile and experience preferences may share one primary Save action.
- **PSET-041:** Password changes use a separate explicit action.
- **PSET-042:** Save operations prevent duplicate submissions while pending.
- **PSET-043:** Successful saves provide concise confirmation without navigating away.
- **PSET-044:** Failed saves preserve unsaved non-secret input and identify the affected field or operation.
- **PSET-045:** Leaving with unsaved profile changes prompts the user to discard or continue editing.

## 8. States and lifecycle

The screen supports loading, ready, edited, saving profile, changing password, success, validation failure, provider failure, and unavailable password authentication states. Profile changes have no draft, revision, or publish lifecycle.

## 9. Data and relationships

- Settings are keyed by stable user identity and are not duplicated per website.
- First name, last name, and username or display name are profile metadata, not membership data.
- Email and password credentials remain owned by the authentication system.
- Interface language and mode are account-scoped preferences.
- Site deletion or membership removal must not delete settings while the account exists.

## 10. Validation and errors

- Required profile fields are validated before submission.
- Email normalization and existing-account conflicts are handled safely.
- Username validation and uniqueness depend on its final product role.
- Password mismatch is reported before contacting the authentication provider.
- Provider errors are translated into understandable messages without leaking internal details.
- The UI must not claim full success if only part of a multi-operation update succeeds.

## 11. API requirements

- Authenticated read and update operations target only the current user.
- Personal settings are not exposed through public REST or GraphQL content APIs.
- Email and password changes use authentication-provider operations, not direct profile mutation.
- Responses never include password values or equivalent secrets.
- Errors distinguish validation, recent-authentication, provider, conflict, and rate-limit failures.

## 12. UI behaviour

- The page identifies itself as personal account settings and may use the user's current name as its heading.
- Information is grouped into Profile, Change password, and Experience sections.
- Profile uses two columns where space permits and one column on narrow screens.
- Password inputs include accessible visibility controls.
- Interface language and mode use selection controls with clear current values.
- A primary Save action remains readily discoverable.
- Site-wide settings do not appear on this screen.
- Loading, saving, success, and error states avoid disruptive layout shifts.

## 13. Performance and scale

- Settings load with the authenticated account context or one focused request.
- Successful preference changes become visible immediately.
- Theme initialization avoids a visible incorrect-theme flash.
- Interface-language options do not require pagination.

## 14. Security and privacy

- Operations derive the target user from the authenticated session, never a client-controlled user ID.
- Email and password changes may require recent authentication.
- Password attempts inherit provider rate limiting and abuse protection.
- Password inputs use appropriate current-password and new-password autocomplete attributes.
- Identity and credential operations are auditable without recording secrets.
- Email conflict messages reveal no unnecessary information about unrelated accounts.

## 15. Local development and production

- Local email confirmation behaviour is documented by the authentication specification.
- Theme and language behaviour matches production except for deliberately unavailable translations.
- Self-hosted installations can configure available interface languages and password policy without patching this UI.

## 16. Accessibility

- The user card and every settings control are keyboard accessible.
- Sections use meaningful headings and form labels.
- Required fields, validation errors, save status, and password results are announced.
- Password visibility controls have action-oriented accessible names.
- Theme choices do not rely on color alone.
- Rejected submissions focus the first invalid field when appropriate.

## 17. Observability and operations

- Log successful and failed profile, email, preference, and password operations without secret values.
- Audit records identify the user, operation, outcome, and timestamp.
- Provider failures retain enough non-sensitive context for diagnosis.

## 18. Acceptance criteria

1. A user can reach Personal settings from the lower-left card by pointer or keyboard.
2. The user can update first name, last name, email, and username or display name, and saved identity appears in the shell.
3. A password-authenticated user can change their password with current, new, and confirmation fields.
4. A provider-only user is not shown a password form that cannot succeed.
5. Interface language can change without changing website content language.
6. System, Light, and Dark modes persist after reload and sign-in.
7. Errors preserve editable input and provide actionable feedback.
8. Another user cannot read or change these settings.
9. Switching websites does not change personal settings.
10. Public content APIs expose no personal-setting data.

## 19. Edge cases

- A user has one name and no last name.
- A Google or other provider account has no password credential.
- Provider identity metadata differs from the saved profile.
- The requested email belongs to another account.
- Email confirmation remains incomplete.
- The system theme changes while Scaffold CMS is open.
- A saved interface language is removed or has incomplete translations.
- The session expires during a save.
- Multiple tabs update preferences concurrently.

## 20. Deferred work

- Avatar management.
- Multi-factor authentication and passkeys.
- Active-session and trusted-device management.
- Account deletion and personal-data export.
- Notification preferences.
- Per-device preference overrides.
- Site-wide settings, which require a separate specification.

## 21. Open questions

- Does the lower-left card navigate directly or first open a menu containing Personal settings and Sign out?
- Is Username a unique sign-in identifier, public handle, or non-unique display name? Is it needed alongside first and last name?
- Do profile and experience changes use only explicit Save, or do interface preferences save immediately?
- Which interface languages are required for the first release?
- Does changing email require confirmation from the old address, new address, or both?
- Does a password change revoke other active sessions?
- Which password-policy options can self-hosted installations configure?

## 22. Decision log

| Date       | Decision                                                                                                                            | Reason                                                                               |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| 2026-07-13 | Personal settings are account-scoped and separate from site-wide settings.                                                          | Identity and interface preferences must follow the user across websites.             |
| 2026-07-13 | The initial fields follow the supplied Strapi reference: profile identity, password change, interface language, and interface mode. | The reference provides a familiar baseline while Scaffold CMS retains its own design. |
