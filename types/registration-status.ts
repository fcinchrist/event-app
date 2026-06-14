/**
 * Re-export RegistrationStatus dari domain/entities/registration
 * agar tidak ada circular import antara mapper & domain entity.
 */
export {
  REGISTRATION_STATUS_VALUES,
  isRegistrationStatusValue,
  type RegistrationStatus,
} from '~/domain/entities/registration'
