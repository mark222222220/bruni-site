import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Glass, Sheet, SheetHeader, T } from '@/components/ui';
import { SECTION_PATH } from '@/lib/nav';
import { useSettings } from '@/lib/settings';
import { ROLE_SECTIONS, ROLES, type Role } from '@/lib/types';

export default function RolePicker() {
  const { s, t, set, tap } = useSettings();
  return (
    <Sheet>
      <SheetHeader title="Войти как" />
      {(Object.keys(ROLES) as Role[]).map((r) => {
        const on = r === s.role;
        return (
          <Pressable
            key={r}
            onPress={() => {
              tap('success');
              set({ role: r });
              router.dismissAll();
              router.replace(SECTION_PATH[ROLE_SECTIONS[r][0]] as '/');
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
          >
            <Glass radius={18} style={{ padding: 14, borderWidth: 2, borderColor: on ? t.accent : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flex: 1, gap: 2 }}>
                <T v="b">{ROLES[r].name}</T>
                <T v="small">{ROLES[r].about}</T>
              </View>
              {on ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: t.accent }} /> : null}
            </Glass>
          </Pressable>
        );
      })}
      <T v="small" style={{ textAlign: 'center' }}>
        В тестовой версии роль выбирается вручную. В рабочей её назначает руководитель.
      </T>
    </Sheet>
  );
}
