import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RootStackParamList } from './src/navigation';
import HomeScreen from './src/screens/HomeScreen';
import ClockScreen from './src/screens/ClockScreen';
import PeopleScreen from './src/screens/PeopleScreen';
import SettingsScreen from './src/screens/SettingsScreen';
import RegisterMemberScreen from './src/screens/RegisterMemberScreen';
import SyncScreen from './src/screens/SyncScreen';
import StatusScreen from './src/screens/StatusScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function App() {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <StatusBar style="light" />
        <Stack.Navigator screenOptions={{ headerShown: false }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen name="Clock" component={ClockScreen} />
          <Stack.Screen name="People" component={PeopleScreen} />
          <Stack.Screen name="RegisterMember" component={RegisterMemberScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen name="Sync" component={SyncScreen} />
          <Stack.Screen name="Status" component={StatusScreen} />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
