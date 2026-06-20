import { Platform } from 'react-native';
import { Colors } from '../../utils/colors';

export const navScreenOptions = {
  headerStyle: {
    backgroundColor: Colors.bg,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 4,
  },
  headerTitleStyle: {
    color: Colors.text,
    fontWeight: '700',
    fontSize: 17,
  },
  headerTintColor: Colors.text,
  tabBarStyle: {
    backgroundColor: Colors.bg,
    borderTopColor: Colors.border,
    borderTopWidth: 1,
    height: Platform.OS === 'ios' ? 88 : 64,
    paddingBottom: Platform.OS === 'ios' ? 28 : 8,
    paddingTop: 8,
  },
  tabBarActiveTintColor: Colors.logoBlueLight,
  tabBarInactiveTintColor: Colors.muted,
  tabBarLabelStyle: {
    fontSize: 11,
    fontWeight: '600',
    letterSpacing: 0.2,
  },
  sceneContainerStyle: { backgroundColor: Colors.bg },
};
