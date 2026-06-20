import { createNavigationContainerRef } from '@react-navigation/native';

export const navigationRef = createNavigationContainerRef();

/** Navigate when the root container is ready (e.g. from Chatbot FAB). */
export function rootNavigate(name, params) {
  if (navigationRef.isReady()) {
    navigationRef.navigate(name, params);
  }
}

export function openLoginScreen() {
  rootNavigate('Auth', { screen: 'Login' });
}
