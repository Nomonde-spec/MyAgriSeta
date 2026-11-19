import { Ionicons } from '@expo/vector-icons';
import React, { useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { palette, radius, spacing } from '@/theme';

export type FilterOption = { id: string; name: string };

export function FilterDropdown({
  label,
  items,
  selectedId,
  onSelect,
}: {
  label?: string;
  items: FilterOption[];
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = items.find((item) => item.id === selectedId) ?? items[0];

  return (
    <View style={styles.container}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label ? `${label}: ${selected?.name ?? 'Select'}` : selected?.name}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={styles.trigger}
      >
        <Text numberOfLines={1} style={styles.triggerText}>{selected?.name ?? 'Select'}</Text>
        <Ionicons name="chevron-down" size={18} color={palette.primaryDark} />
      </Pressable>
      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.backdrop} onPress={() => setOpen(false)}>
          <Pressable style={styles.menu} onPress={(event) => event.stopPropagation()}>
            {label ? <Text style={styles.menuTitle}>{label}</Text> : null}
            {items.map((item) => (
              <Pressable
                key={item.id || `all-${item.name}`}
                accessibilityRole="menuitem"
                accessibilityState={{ selected: item.id === selectedId }}
                onPress={() => {
                  onSelect(item.id);
                  setOpen(false);
                }}
                style={[styles.option, item.id === selectedId && styles.optionSelected]}
              >
                <Text style={[styles.optionText, item.id === selectedId && styles.optionTextSelected]}>{item.name}</Text>
                {item.id === selectedId ? <Ionicons name="checkmark" size={18} color={palette.primary} /> : null}
              </Pressable>
            ))}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { minWidth: 150, flex: 1, marginTop: spacing.sm },
  label: { color: palette.muted, fontSize: 12, fontWeight: '700', marginBottom: 6 },
  trigger: {
    alignItems: 'center',
    backgroundColor: palette.surface,
    borderColor: palette.border,
    borderRadius: radius.md,
    borderWidth: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    minHeight: 44,
    paddingHorizontal: spacing.md,
  },
  triggerText: { color: palette.text, flex: 1, fontSize: 14, marginRight: spacing.sm },
  backdrop: { alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.35)', flex: 1, justifyContent: 'center', padding: spacing.lg },
  menu: { backgroundColor: palette.surface, borderRadius: radius.lg, maxWidth: 440, padding: spacing.md, width: '100%' },
  menuTitle: { color: palette.text, fontSize: 16, fontWeight: '800', marginBottom: spacing.sm },
  option: { alignItems: 'center', borderRadius: radius.md, flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md },
  optionSelected: { backgroundColor: palette.surfaceAlt },
  optionText: { color: palette.text, flex: 1, fontSize: 14 },
  optionTextSelected: { color: palette.primaryDark, fontWeight: '700' },
});
