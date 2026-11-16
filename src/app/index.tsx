import React from 'react';
import { Redirect } from 'expo-router';

export default function AdminIndex() {
  return <Redirect href={'/admin/actor-lab' as any} />;
}
