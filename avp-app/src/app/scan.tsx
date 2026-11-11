import { CameraView, useCameraPermissions } from 'expo-camera';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Button, IconButton, T } from '@/components/ui';
import { useData } from '@/lib/data';
import { useSettings } from '@/lib/settings';
import { nameFromQr } from '@/lib/stock';

/** Сканер QR с наклейки на полке → карточка материала. */
export default function Scan() {
  const [perm, ask] = useCameraPermissions();
  const { snap } = useData();
  const { t, tap } = useSettings();
  const ins = useSafeAreaInsets();
  const done = useRef(false);
  const [msg, setMsg] = useState('Наведите камеру на QR-код на полке');

  const onScan = ({ data }: { data: string }) => {
    if (done.current) return;
    const name = nameFromQr(data);
    if (!name) return setMsg('Это не наклейка AVP');
    const x = snap.stock.find((i) => i.name === name);
    if (!x) return setMsg(`«${name}» нет в остатках`);
    done.current = true;
    tap('success');
    router.replace({ pathname: '/stock-item', params: { id: x.id } });
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }}>
      {perm?.granted ? (
        <CameraView style={StyleSheet.absoluteFill} facing="back" barcodeScannerSettings={{ barcodeTypes: ['qr'] }} onBarcodeScanned={onScan} />
      ) : (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 }}>
          <T v="h" style={{ color: '#fff', textAlign: 'center' }}>
            Нужен доступ к камере
          </T>
          <View style={{ flexDirection: 'row', alignSelf: 'stretch' }}>
            <Button title="Разрешить камеру" icon="camera" onPress={ask} />
          </View>
        </View>
      )}
      <View pointerEvents="none" style={{ position: 'absolute', top: '28%', alignSelf: 'center', width: 250, height: 250, borderRadius: 28, borderWidth: 3, borderColor: t.accent }} />
      <View style={{ position: 'absolute', top: ins.top + 10, left: 16 }}>
        <IconButton icon="back" label="Назад" onPress={() => router.back()} />
      </View>
      <View style={{ position: 'absolute', bottom: ins.bottom + 40, left: 24, right: 24, backgroundColor: 'rgba(17,17,19,0.85)', borderRadius: 18, padding: 14 }}>
        <T v="b" style={{ color: '#fff', textAlign: 'center' }}>
          {msg}
        </T>
      </View>
    </View>
  );
}
