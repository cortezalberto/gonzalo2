// ============================================
// Google OAuth Types
// ============================================

export interface AuthUser {
  id: string
  email: string
  full_name: string
  picture?: string
  is_verified: boolean
  role: string
  created_at: string
}

export interface GoogleAuthResponse {
  access_token: string
  refresh_token: string
  token_type: string
  expires_in: number
  user: AuthUser
  is_new_user: boolean
}

export interface GoogleCredentialResponse {
  /** The JWT credential from Google (may be undefined on error) */
  credential?: string
  /** How the credential was selected */
  select_by?: string
  /** The Google Client ID */
  clientId?: string
  /** Error code if authentication failed */
  error?: string
  /** Error description URI */
  error_uri?: string
}

export interface GoogleAccountsId {
  initialize: (config: GoogleIdConfiguration) => void
  prompt: (callback?: (notification: PromptMomentNotification) => void) => void
  renderButton: (element: HTMLElement, options: GsiButtonConfiguration) => void
  disableAutoSelect: () => void
  cancel: () => void
}

export interface GoogleIdConfiguration {
  client_id: string
  callback: (response: GoogleCredentialResponse) => void
  auto_select?: boolean
  login_uri?: string
  native_callback?: (response: GoogleCredentialResponse) => void
  cancel_on_tap_outside?: boolean
  prompt_parent_id?: string
  nonce?: string
  context?: 'signin' | 'signup' | 'use'
  state_cookie_domain?: string
  ux_mode?: 'popup' | 'redirect'
  allowed_parent_origin?: string | string[]
  intermediate_iframe_close_callback?: () => void
  itp_support?: boolean
}

export interface PromptMomentNotification {
  isDisplayMoment: () => boolean
  isDisplayed: () => boolean
  isNotDisplayed: () => boolean
  getNotDisplayedReason: () => string
  isSkippedMoment: () => boolean
  getSkippedReason: () => string
  isDismissedMoment: () => boolean
  getDismissedReason: () => string
  getMomentType: () => string
}

export interface GsiButtonConfiguration {
  type?: 'standard' | 'icon'
  theme?: 'outline' | 'filled_blue' | 'filled_black'
  size?: 'large' | 'medium' | 'small'
  text?: 'signin_with' | 'signup_with' | 'continue_with' | 'signin'
  shape?: 'rectangular' | 'pill' | 'circle' | 'square'
  logo_alignment?: 'left' | 'center'
  width?: number | string
  locale?: string
}

// Extend Window interface for google global
declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId
      }
    }
  }
}
