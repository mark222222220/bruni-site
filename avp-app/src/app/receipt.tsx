import { Redirect, useLocalSearchParams } from 'expo-router';

/** Старый адрес «Приход» — теперь общий экран складской операции. */
export default function Receipt() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  return <Redirect href={{ pathname: '/stock-move', params: { kind: 'in', ...(id ? { id } : {}) } }} />;
}
