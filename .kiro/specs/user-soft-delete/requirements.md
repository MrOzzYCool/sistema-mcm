# Requirements Document

## Introduction

This feature adds a safe, non-destructive "soft delete" mechanism to the Gestión de Usuarios admin panel. Instead of physically removing user records, the system sets the user's `estado` to `eliminado`, preserving all historical data (inscripciones, historial_ciclos, alumno_cursos, notas) and disabling the user's authentication account. The action is restricted to the super_admin role, includes an audit trail, and provides UI controls for managing and filtering eliminated users.

## Glossary

- **System**: The Gestión de Usuarios module of the I.E.S. Privada Margarita Cabrera admin dashboard
- **Soft_Delete_API**: The server-side API endpoint responsible for processing user soft-deletion requests
- **Users_Listing_API**: The server-side API endpoint at `/api/admin/users` that returns the list of user profiles
- **Users_Table_UI**: The users table component rendered in `src/app/dashboard/usuarios/page.tsx`
- **Confirmation_Modal**: The dialog component displayed to the super_admin before executing a soft-delete action
- **Super_Admin**: The administrator role with email `admin@margaritacabrera.edu.pe`, the only role authorized to manage users
- **Admin_Level_User**: A user whose `rol` is one of: `super_admin`, `staff_tramites`, `gestor`, `actualizacion`
- **Regular_User**: A user whose `rol` is `alumno` or `profesor`
- **Estado_Field**: The `estado` column in the `profiles` table, constrained to `activo`, `inactivo`, or `eliminado`
- **Auth_Account**: The user's record in Supabase Auth (`auth.users`), which controls login capability
- **Audit_Log**: The `historial_auditoria` table that records administrative actions
- **Historical_Data**: Records in `inscripciones`, `historial_ciclos`, `alumno_cursos`, and related tables linked to a user profile

## Requirements

### Requirement 1: Database Schema Update for Eliminado State

**User Story:** As a super_admin, I want the database to support an `eliminado` state for user profiles, so that soft-deleted users are distinguished from active and inactive users.

#### Acceptance Criteria

1. THE System SHALL support `activo`, `inactivo`, and `eliminado` as valid values for the Estado_Field in the `profiles` table
2. WHEN the Estado_Field check constraint is updated, THE System SHALL preserve all existing `activo` and `inactivo` records without modification
3. THE System SHALL maintain all foreign key relationships between the `profiles` table and `inscripciones`, `historial_ciclos`, and `alumno_cursos` tables without alteration

### Requirement 2: Soft Delete API Endpoint

**User Story:** As a super_admin, I want a dedicated API endpoint to soft-delete users, so that the deletion is processed securely on the server side, separate from the existing toggle functionality.

#### Acceptance Criteria

1. THE Soft_Delete_API SHALL expose a POST endpoint at a dedicated route separate from the existing `/api/admin/toggle-user` endpoint
2. WHEN the Soft_Delete_API receives a valid soft-delete request, THE Soft_Delete_API SHALL update the target user's Estado_Field to `eliminado`
3. WHEN the Soft_Delete_API receives a request without a valid super_admin authentication token, THE Soft_Delete_API SHALL return HTTP 403 with an error message
4. WHEN the Soft_Delete_API receives a request with a missing or empty `userId` parameter, THE Soft_Delete_API SHALL return HTTP 400 with a descriptive error message
5. IF the database update fails, THEN THE Soft_Delete_API SHALL return HTTP 500 with the database error message
6. WHEN the Soft_Delete_API successfully soft-deletes a user, THE Soft_Delete_API SHALL ban the target user's Auth_Account using the Supabase Admin API so the user cannot log in
7. IF the Auth_Account ban operation fails, THEN THE Soft_Delete_API SHALL return an error response indicating the ban failed, even if the Estado_Field was updated

### Requirement 3: Audit Trail for Soft Delete Actions

**User Story:** As a super_admin, I want every soft-delete action to be logged in the audit trail, so that there is a complete record of who deleted which user and when.

#### Acceptance Criteria

1. WHEN the Soft_Delete_API successfully soft-deletes a user, THE Soft_Delete_API SHALL insert a record into the Audit_Log with `accion` set to `eliminar_usuario`
2. THE Soft_Delete_API SHALL include the `admin_id`, `admin_email`, and `target_id` fields in the Audit_Log record
3. THE Soft_Delete_API SHALL include a `detalle` JSON field in the Audit_Log record containing the target user's `nombre_completo`, `email`, and `rol` at the time of deletion

### Requirement 4: Historical Data Preservation

**User Story:** As a super_admin, I want all historical data associated with a soft-deleted user to remain intact, so that academic records, enrollment history, and grades are never lost.

#### Acceptance Criteria

1. WHEN a user is soft-deleted, THE System SHALL retain all records in `inscripciones` linked to the user's `alumno_id`
2. WHEN a user is soft-deleted, THE System SHALL retain all records in `historial_ciclos` linked to the user's `alumno_id`
3. WHEN a user is soft-deleted, THE System SHALL retain all records in `alumno_cursos` linked to the user's `alumno_id`
4. THE System SHALL perform soft deletion by updating only the Estado_Field, without executing any DELETE statement on the `profiles` table or the `auth.users` table

### Requirement 5: Eliminar Button in Users Table

**User Story:** As a super_admin, I want an "Eliminar" button in the actions column of the users table, so that I can initiate the soft-delete process for any user directly from the listing.

#### Acceptance Criteria

1. THE Users_Table_UI SHALL display an "Eliminar" button with a Trash icon in the actions column for each user row
2. THE Users_Table_UI SHALL render the "Eliminar" button as a separate control from the existing activate/deactivate toggle button and the reset password button
3. WHILE a user's Estado_Field is `eliminado`, THE Users_Table_UI SHALL hide the "Eliminar" button for that user row
4. WHEN the super_admin clicks the "Eliminar" button, THE Users_Table_UI SHALL open the Confirmation_Modal before executing any server request

### Requirement 6: Confirmation Modal with Warning

**User Story:** As a super_admin, I want a confirmation modal with a clear warning before soft-deleting a user, so that accidental deletions are prevented.

#### Acceptance Criteria

1. WHEN the Confirmation_Modal is displayed for a Regular_User, THE Confirmation_Modal SHALL show the target user's full name, email, and role
2. WHEN the Confirmation_Modal is displayed for a Regular_User, THE Confirmation_Modal SHALL display a warning message explaining that the user will be deactivated and unable to log in
3. WHEN the Confirmation_Modal is displayed for an Admin_Level_User, THE Confirmation_Modal SHALL display an additional prominent warning indicating that the target is an administrative user
4. WHEN the Confirmation_Modal is displayed for an Admin_Level_User, THE Confirmation_Modal SHALL require the super_admin to type the word "ELIMINAR" in a text input to enable the confirm button
5. WHEN the super_admin clicks the "Cancelar" button in the Confirmation_Modal, THE Confirmation_Modal SHALL close without executing any action
6. WHEN the super_admin confirms the deletion in the Confirmation_Modal, THE Users_Table_UI SHALL send the soft-delete request to the Soft_Delete_API and refresh the user list upon success
7. WHILE the soft-delete request is in progress, THE Confirmation_Modal SHALL disable the confirm button and display a loading indicator

### Requirement 7: Auth Account Disabling

**User Story:** As a super_admin, I want the soft-deleted user's Supabase Auth account to be banned, so that the user cannot log in after being eliminated.

#### Acceptance Criteria

1. WHEN the Soft_Delete_API processes a soft-delete request, THE Soft_Delete_API SHALL call the Supabase Admin API `updateUserById` with `ban_duration: "876600h"` to effectively ban the Auth_Account permanently
2. WHEN a banned user attempts to log in, THE System SHALL reject the authentication attempt with an appropriate error message from Supabase Auth

### Requirement 8: Filtered Visibility of Eliminated Users

**User Story:** As a super_admin, I want eliminated users to be hidden from the default listing but accessible through a filter, so that the active user list remains clean while still allowing review of eliminated accounts.

#### Acceptance Criteria

1. THE Users_Listing_API SHALL return all user profiles including those with Estado_Field set to `eliminado`
2. THE Users_Table_UI SHALL add an estado filter with options: `todos`, `activo`, `inactivo`, `eliminado`
3. WHEN the estado filter is set to `todos`, THE Users_Table_UI SHALL display users with `activo` and `inactivo` states, excluding `eliminado` users
4. WHEN the estado filter is set to `eliminado`, THE Users_Table_UI SHALL display only users with Estado_Field set to `eliminado`
5. WHEN the estado filter is set to `activo` or `inactivo`, THE Users_Table_UI SHALL display only users matching the selected state
6. THE Users_Table_UI SHALL display the `eliminado` estado badge with a distinct visual style (gray background) to differentiate from `activo` (green) and `inactivo` (red)

### Requirement 9: Prevention of Soft-Deleting Own Account

**User Story:** As a super_admin, I want the system to prevent me from soft-deleting my own account, so that the admin panel always has at least one active administrator.

#### Acceptance Criteria

1. WHEN the super_admin attempts to soft-delete a user whose `id` matches the authenticated super_admin's `id`, THE Soft_Delete_API SHALL return HTTP 400 with an error message indicating self-deletion is not permitted
2. THE Users_Table_UI SHALL hide the "Eliminar" button for the row corresponding to the currently authenticated super_admin

### Requirement 10: Existing Toggle Functionality Isolation

**User Story:** As a super_admin, I want the existing activate/deactivate toggle to remain unchanged and independent from the soft-delete feature, so that both workflows coexist without interference.

#### Acceptance Criteria

1. THE System SHALL keep the existing `/api/admin/toggle-user` endpoint unchanged, continuing to toggle between `activo` and `inactivo` states only
2. WHILE a user's Estado_Field is `eliminado`, THE Users_Table_UI SHALL hide the activate/deactivate toggle button for that user row
3. THE toggle-user endpoint SHALL reject requests that attempt to set Estado_Field to `eliminado`
