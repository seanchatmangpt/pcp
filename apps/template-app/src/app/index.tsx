import { Redirect } from 'expo-router';
import { useSession } from '@/context/SessionProvider';

export default function Index() {
  const { session, loading } = useSession();

  if (loading) {
    return null;
  }

  if (!session) {
    return <Redirect href="/(auth)" />;
  }

  return <Redirect href="/(tabs)" />;
}
