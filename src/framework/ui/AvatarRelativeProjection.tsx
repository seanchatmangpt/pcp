import React from 'react';
import { Stack as ExpoStack, Tabs as ExpoTabs } from 'expo-router';
import { View, Text, StyleSheet, TouchableOpacity, TextInput } from 'react-native';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { AvatarRole } from '@/src/lib/truex/avatar/types';
import { PROJECTION_MATRIX } from '@/src/lib/truex/avatar/matrix';

type CustomStackType = any;
type CustomTabsType = any;

// Helper component for conditional gating
export const StackProtected: React.FC<{ guard: boolean; children: React.ReactNode }> = ({
  guard,
  children,
}) => {
  return guard ? <>{children}</> : null;
};
StackProtected.displayName = 'StackProtected';

export const TabsProtected: React.FC<{ guard: boolean; children: React.ReactNode }> = ({
  guard,
  children,
}) => {
  return guard ? <>{children}</> : null;
};
TabsProtected.displayName = 'TabsProtected';

// Custom hooks for render stability and avoiding double-renders
function useShallowStable<T>(obj: T): T {
  const ref = React.useRef<T>(obj);

  const prev = ref.current;
  let isEquivalent = prev === obj;
  if (!isEquivalent && prev && obj && typeof prev === 'object' && typeof obj === 'object') {
    const keysPrev = Object.keys(prev);
    const keysObj = Object.keys(obj);
    if (keysPrev.length === keysObj.length) {
      isEquivalent = true;
      for (const key of keysPrev) {
        if ((prev as any)[key] !== (obj as any)[key]) {
          isEquivalent = false;
          break;
        }
      }
    }
  }

  if (!isEquivalent) {
    ref.current = obj;
  }

  return ref.current;
}

function useMemoizedChildren(children: React.ReactNode): React.ReactNode[] {
  const prevChildrenRef = React.useRef<React.ReactNode[]>([]);
  const prevInputRef = React.useRef<React.ReactNode>(null);

  return React.useMemo(() => {
    if (children === prevInputRef.current) {
      return prevChildrenRef.current;
    }

    const list: React.ReactNode[] = [];
    React.Children.forEach(children, (child) => {
      if (!child || !React.isValidElement(child)) return;

      if (child.type === StackProtected || (child.type as any).displayName === 'StackProtected') {
        const guardedChild = child as React.ReactElement<any>;
        if (guardedChild.props.guard) {
          React.Children.forEach(guardedChild.props.children, (nestedChild) => {
            if (nestedChild) list.push(nestedChild);
          });
        }
      } else if (
        child.type === TabsProtected ||
        (child.type as any).displayName === 'TabsProtected'
      ) {
        const guardedChild = child as React.ReactElement<any>;
        if (guardedChild.props.guard) {
          React.Children.forEach(guardedChild.props.children, (nestedChild) => {
            if (nestedChild) list.push(nestedChild);
          });
        }
      } else {
        list.push(child);
      }
    });

    const prevList = prevChildrenRef.current;
    let isEquivalent = prevList.length === list.length;
    if (isEquivalent) {
      for (let i = 0; i < list.length; i++) {
        const c1 = list[i];
        const c2 = prevList[i];
        if (!React.isValidElement(c1) || !React.isValidElement(c2)) {
          if (c1 !== c2) {
            isEquivalent = false;
            break;
          }
        } else {
          if (c1.type !== c2.type || c1.key !== c2.key) {
            isEquivalent = false;
            break;
          }
          const p1 = c1.props as any;
          const p2 = c2.props as any;
          const k1 = Object.keys(p1);
          const k2 = Object.keys(p2);
          if (k1.length !== k2.length) {
            isEquivalent = false;
            break;
          }
          for (const key of k1) {
            if (key === 'children') {
              if (p1.children !== p2.children) {
                isEquivalent = false;
                break;
              }
            } else if (p1[key] !== p2[key]) {
              isEquivalent = false;
              break;
            }
          }
          if (!isEquivalent) break;
        }
      }
    }

    if (isEquivalent) {
      prevInputRef.current = children;
      return prevList;
    }

    prevChildrenRef.current = list;
    prevInputRef.current = children;
    return list;
  }, [children]);
}

const StackComponent = React.forwardRef<any, any>(
  ({ avatarRelativeProjectionOptions, screenOptions, children, ...props }, ref) => {
    const processedChildren = useMemoizedChildren(children);
    const stableScreenOptions = useShallowStable(avatarRelativeProjectionOptions || screenOptions);

    return (
      <ExpoStack ref={ref} screenOptions={stableScreenOptions} {...props}>
        {processedChildren}
      </ExpoStack>
    );
  }
);
StackComponent.displayName = 'StackComponent';

export const Stack = Object.assign(StackComponent, ExpoStack, {
  AvatarRelativeProjection: ExpoStack.Screen,
  Protected: StackProtected,
}) as unknown as CustomStackType;

const TabsComponent = React.forwardRef<any, any>(
  ({ avatarRelativeProjectionOptions, screenOptions, children, ...props }, ref) => {
    const processedChildren = useMemoizedChildren(children);
    const stableScreenOptions = useShallowStable(avatarRelativeProjectionOptions || screenOptions);

    return (
      <ExpoTabs ref={ref} screenOptions={stableScreenOptions} {...props}>
        {processedChildren}
      </ExpoTabs>
    );
  }
);
TabsComponent.displayName = 'TabsComponent';

export const Tabs = Object.assign(TabsComponent, ExpoTabs, {
  AvatarRelativeProjection: ExpoTabs.Screen,
  Protected: TabsProtected,
}) as unknown as CustomTabsType;

export interface AvatarRelativeProjectionMatrixViewProps {
  initialData?: {
    openSlots?: number;
    candidates?: string[];
    shortageRatio?: number;
    runId?: string;
    history?: Array<{ timestamp: string; event: string; detail: string }>;
    topology?: { nodes: number; channels: number; supervisorStatus: string };
    stateHash?: string;
  };
}

const ROLES: AvatarRole[] = [
  'guest',
  'member',
  'volunteer',
  'teamLead',
  'pastor',
  'admin',
  'operator',
];

const ROLE_COLORS: Record<AvatarRole, string> = {
  guest: '#64748B', // Slate
  member: '#3B82F6', // Blue
  volunteer: '#10B981', // Green
  teamLead: '#8B5CF6', // Purple
  pastor: '#F59E0B', // Amber
  admin: '#EF4444', // Red
  operator: '#06B6D4', // Cyan
};

interface AvatarProjectionCardProps {
  role: AvatarRole;
  data: any;
  roleColor: string;
  projectionKey?: string;
}

const AvatarProjectionCard = React.memo(
  ({ role, data, roleColor, projectionKey = 'volunteer_shortage' }: AvatarProjectionCardProps) => {
    const projection = (PROJECTION_MATRIX[projectionKey] || PROJECTION_MATRIX.volunteer_shortage)(
      data,
      role
    );

    return (
      <View style={[matrixStyles.roleCard, !projection.visible && matrixStyles.roleCardHidden]}>
        {/* Card Header */}
        <View style={[matrixStyles.roleHeader, { borderLeftColor: roleColor }]}>
          <View style={matrixStyles.roleTitleContainer}>
            <View
              style={[
                matrixStyles.roleBadge,
                { backgroundColor: roleColor + '20', borderColor: roleColor },
              ]}>
              <Text style={[matrixStyles.roleBadgeText, { color: roleColor }]}>{role}</Text>
            </View>
            <Text style={matrixStyles.surfaceText} accessibilityRole="header">
              {projection.surface.toUpperCase()}
            </Text>
          </View>
          <View style={matrixStyles.visibilityBadge}>
            <FontAwesome
              name={projection.visible ? 'eye' : 'eye-slash'}
              size={14}
              color={projection.visible ? '#10B981' : '#64748B'}
            />
            <Text
              style={[
                matrixStyles.visibilityText,
                { color: projection.visible ? '#10B981' : '#64748B' },
              ]}>
              {projection.visible ? 'Visible' : 'Hidden'}
            </Text>
          </View>
        </View>

        {/* Card Body */}
        {projection.visible ? (
          <View style={matrixStyles.cardBody}>
            {projection.payload?.message && (
              <Text style={matrixStyles.messageText}>{projection.payload.message}</Text>
            )}

            {/* Actions */}
            <View style={matrixStyles.actionsGroup}>
              <Text style={matrixStyles.cardLabel}>Allowed Actions:</Text>
              <View style={matrixStyles.actionBadgesList}>
                {projection.allowedActions.length > 0 ? (
                  projection.allowedActions.map((act) => (
                    <View key={act} style={matrixStyles.actionBadge}>
                      <Text style={matrixStyles.actionBadgeText}>⚡ {act}</Text>
                    </View>
                  ))
                ) : (
                  <Text style={matrixStyles.noActionsText}>None</Text>
                )}
              </View>
            </View>

            {/* Payload Details */}
            <View style={matrixStyles.payloadSection}>
              <Text style={matrixStyles.cardLabel}>Projected Payload State:</Text>
              <View style={matrixStyles.payloadBox}>
                {role === 'member' && (
                  <Text style={matrixStyles.payloadText}>• Context: Volunteer encouragement</Text>
                )}
                {role === 'volunteer' && (
                  <Text style={matrixStyles.payloadText}>
                    • Open slots count: {projection.payload?.openSlots}
                  </Text>
                )}
                {role === 'teamLead' && (
                  <Text style={matrixStyles.payloadText}>
                    • Candidates count: {projection.payload?.candidates?.length ?? 0}
                  </Text>
                )}
                {role === 'pastor' && (
                  <View>
                    <Text style={matrixStyles.payloadText}>
                      • Risk Level: {projection.payload?.riskLevel}
                    </Text>
                    <Text style={matrixStyles.payloadText}>
                      • Shortage Ratio: {projection.payload?.shortageRatio}
                    </Text>
                  </View>
                )}
                {role === 'admin' && (
                  <View>
                    <Text style={matrixStyles.payloadText}>
                      • Run ID: {projection.payload?.runId}
                    </Text>
                    <Text style={matrixStyles.payloadText}>
                      • History Logs: {projection.payload?.history?.length ?? 0} entries
                    </Text>
                  </View>
                )}
                {role === 'operator' && (
                  <View>
                    <Text style={matrixStyles.payloadText}>
                      • Nodes count: {projection.payload?.topology?.nodes ?? 0}
                    </Text>
                    <Text style={matrixStyles.payloadText}>
                      • State Hash: {projection.payload?.stateHash}
                    </Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        ) : (
          <View style={matrixStyles.cardBodyHidden}>
            <Text style={matrixStyles.hiddenMessage}>
              This avatar role does not have authorization to view this state projection.
            </Text>
          </View>
        )}
      </View>
    );
  },
  (prevProps, nextProps) => {
    if (prevProps.role !== nextProps.role) return false;
    if (prevProps.roleColor !== nextProps.roleColor) return false;

    const key = prevProps.projectionKey || 'volunteer_shortage';
    const nextKey = nextProps.projectionKey || 'volunteer_shortage';
    if (key !== nextKey) return false;

    const role = prevProps.role;
    const d1 = prevProps.data;
    const d2 = nextProps.data;

    // Fast path for volunteer_shortage
    if (key === 'volunteer_shortage') {
      if (role === 'guest' || role === 'member') return true;
      if (role === 'volunteer') return d1.openSlots === d2.openSlots;
      if (role === 'pastor') return d1.shortageRatio === d2.shortageRatio;
      if (role === 'teamLead') {
        if (d1.candidates === d2.candidates) return true;
        if (!d1.candidates || !d2.candidates) return false;
        if (d1.candidates.length !== d2.candidates.length) return false;
        for (let i = 0; i < d1.candidates.length; i++) {
          if (d1.candidates[i] !== d2.candidates[i]) return false;
        }
        return true;
      }
      if (role === 'admin') {
        if (d1.runId !== d2.runId) return false;
        if (d1.history === d2.history) return true;
        if (!d1.history || !d2.history) return false;
        if (d1.history.length !== d2.history.length) return false;
        for (let i = 0; i < d1.history.length; i++) {
          const h1 = d1.history[i];
          const h2 = d2.history[i];
          if (h1.timestamp !== h2.timestamp || h1.event !== h2.event || h1.detail !== h2.detail)
            return false;
        }
        return true;
      }
      if (role === 'operator') {
        if (d1.stateHash !== d2.stateHash) return false;
        if (d1.topology === d2.topology) return true;
        if (!d1.topology || !d2.topology) return false;
        return (
          d1.topology.nodes === d2.topology.nodes &&
          d1.topology.channels === d2.topology.channels &&
          d1.topology.supervisorStatus === d2.topology.supervisorStatus
        );
      }
    }

    // Generic fallback: evaluate and compare projection outputs
    const projFn1 = PROJECTION_MATRIX[key];
    const projFn2 = PROJECTION_MATRIX[nextKey];
    if (!projFn1 || !projFn2) return false;

    const p1 = projFn1(d1, role);
    const p2 = projFn2(d2, role);

    if (p1.visible !== p2.visible) return false;
    if (p1.surface !== p2.surface) return false;

    if (p1.allowedActions.length !== p2.allowedActions.length) return false;
    for (let i = 0; i < p1.allowedActions.length; i++) {
      if (p1.allowedActions[i] !== p2.allowedActions[i]) return false;
    }

    if (p1.payload === p2.payload) return true;
    if (!p1.payload || !p2.payload) return false;

    const keys1 = Object.keys(p1.payload);
    const keys2 = Object.keys(p2.payload);
    if (keys1.length !== keys2.length) return false;

    for (const k of keys1) {
      const val1 = p1.payload[k];
      const val2 = p2.payload[k];
      if (Array.isArray(val1) && Array.isArray(val2)) {
        if (val1.length !== val2.length) return false;
        for (let i = 0; i < val1.length; i++) {
          if (
            typeof val1[i] === 'object' &&
            val1[i] !== null &&
            typeof val2[i] === 'object' &&
            val2[i] !== null
          ) {
            const subKeys1 = Object.keys(val1[i]);
            const subKeys2 = Object.keys(val2[i]);
            if (subKeys1.length !== subKeys2.length) return false;
            for (const subK of subKeys1) {
              if (val1[i][subK] !== val2[i][subK]) return false;
            }
          } else {
            if (val1[i] !== val2[i]) return false;
          }
        }
      } else if (
        typeof val1 === 'object' &&
        val1 !== null &&
        typeof val2 === 'object' &&
        val2 !== null
      ) {
        const subKeys1 = Object.keys(val1);
        const subKeys2 = Object.keys(val2);
        if (subKeys1.length !== subKeys2.length) return false;
        for (const subK of subKeys1) {
          if (val1[subK] !== val2[subK]) return false;
        }
      } else {
        if (val1 !== val2) return false;
      }
    }

    return true;
  }
);
AvatarProjectionCard.displayName = 'AvatarProjectionCard';

export function AvatarRelativeProjectionMatrixView({
  initialData,
}: AvatarRelativeProjectionMatrixViewProps) {
  const [openSlots, setOpenSlots] = React.useState(initialData?.openSlots ?? 4);
  const [candidates, setCandidates] = React.useState<string[]>(
    initialData?.candidates ?? ['Sarah Brown', 'Michael Green', 'David White']
  );
  const [stateHash, setStateHash] = React.useState(initialData?.stateHash ?? 'vkg_genesis_a4f9');

  const shortageRatio = Number((openSlots / 8).toFixed(2));

  // Stabilize initialData fields
  const initialRunId = initialData?.runId;
  const initialHistory = initialData?.history;
  const initialTopology = initialData?.topology;

  const memoizedInitialData = React.useMemo(() => {
    return {
      runId: initialRunId ?? 'run-9988',
      history: initialHistory ?? [
        { timestamp: '16:21:05', event: 'slot_opened', detail: 'Slot opened by cancellation' },
        { timestamp: '16:20:12', event: 'shift_assigned', detail: 'Sarah assigned by teamLead' },
      ],
      topology: initialTopology ?? { nodes: 12, channels: 4, supervisorStatus: 'healthy' },
    };
  }, [initialRunId, initialHistory, initialTopology]);

  const data = React.useMemo(
    () => ({
      openSlots,
      candidates,
      shortageRatio,
      runId: memoizedInitialData.runId,
      history: memoizedInitialData.history,
      topology: memoizedInitialData.topology,
      stateHash,
    }),
    [openSlots, candidates, shortageRatio, stateHash, memoizedInitialData]
  );

  const addCandidate = React.useCallback(() => {
    const names = [
      'Emma Stone',
      'Liam Neeson',
      'Olivia Wilde',
      'Noah Centineo',
      'Sophia Loren',
      'Lucas Scott',
    ];
    setCandidates((prev) => {
      const randomName = names[Math.floor(Math.random() * names.length)] + ` (${prev.length + 1})`;
      return [...prev, randomName];
    });
  }, []);

  const removeCandidate = React.useCallback((index: number) => {
    setCandidates((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const decreaseOpenSlots = React.useCallback(() => {
    setOpenSlots((prev) => Math.max(0, prev - 1));
  }, []);

  const increaseOpenSlots = React.useCallback(() => {
    setOpenSlots((prev) => Math.min(8, prev + 1));
  }, []);

  const handleSelectStep = React.useCallback((val: number) => {
    setOpenSlots(val);
  }, []);

  return (
    <View style={matrixStyles.container}>
      <Text style={matrixStyles.sectionTitle}>Interactive Projection Control</Text>

      {/* Controls */}
      <View style={matrixStyles.controlsCard}>
        <View style={matrixStyles.controlRow}>
          <View style={matrixStyles.controlCol}>
            <Text style={matrixStyles.controlLabel}>Open Slots: {openSlots}</Text>
            <View style={matrixStyles.btnGroup}>
              <TouchableOpacity
                style={matrixStyles.smallBtn}
                onPress={decreaseOpenSlots}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Decrease open slots">
                <Text style={matrixStyles.btnText}>-</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={matrixStyles.smallBtn}
                onPress={increaseOpenSlots}
                accessible={true}
                accessibilityRole="button"
                accessibilityLabel="Increase open slots">
                <Text style={matrixStyles.btnText}>+</Text>
              </TouchableOpacity>
            </View>
          </View>

          <View style={matrixStyles.controlCol}>
            <Text style={matrixStyles.controlLabel}>Shortage Ratio: {shortageRatio}</Text>
            <View style={matrixStyles.ratioIndicatorContainer}>
              <View
                style={[
                  matrixStyles.ratioIndicator,
                  {
                    width: `${shortageRatio * 100}%`,
                    backgroundColor:
                      shortageRatio > 0.6 ? '#EF4444' : shortageRatio > 0.3 ? '#F59E0B' : '#10B981',
                  },
                ]}
              />
            </View>
          </View>
        </View>

        <View style={matrixStyles.divider} />

        {/* Interactive Slider Section */}
        <View style={matrixStyles.sliderSection}>
          <Text style={matrixStyles.controlLabel}>Interactive Open Slots Slider</Text>
          <View style={matrixStyles.sliderWrapper}>
            <View style={matrixStyles.sliderTrack} testID="slider-track">
              <View style={[matrixStyles.sliderFill, { width: `${(openSlots / 8) * 100}%` }]} />
              <View style={matrixStyles.sliderStepsContainer}>
                {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((val) => (
                  <TouchableOpacity
                    key={val}
                    testID={`slider-step-${val}`}
                    style={[
                      matrixStyles.sliderStepPoint,
                      openSlots === val && matrixStyles.sliderStepPointActive,
                    ]}
                    onPress={() => handleSelectStep(val)}
                    accessible={true}
                    accessibilityRole="button"
                    accessibilityLabel={`Set open slots to ${val}`}
                    accessibilityState={{ selected: openSlots === val }}>
                    <Text
                      style={[
                        matrixStyles.sliderStepText,
                        openSlots === val && matrixStyles.sliderStepTextActive,
                      ]}>
                      {val}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>
        </View>

        <View style={matrixStyles.divider} />

        <View style={matrixStyles.candidatesSection}>
          <View style={matrixStyles.candidatesHeader}>
            <Text style={matrixStyles.controlLabel}>Candidates ({candidates.length})</Text>
            <TouchableOpacity
              style={matrixStyles.addBtn}
              onPress={addCandidate}
              accessible={true}
              accessibilityRole="button"
              accessibilityLabel="Add Candidate">
              <Text style={matrixStyles.addBtnText}>+ Add Candidate</Text>
            </TouchableOpacity>
          </View>
          <View style={matrixStyles.candidatesList}>
            {candidates.map((cand, idx) => (
              <View key={idx} style={matrixStyles.candidateBadge}>
                <Text style={matrixStyles.candidateText} numberOfLines={1}>
                  {cand}
                </Text>
                <TouchableOpacity
                  onPress={() => removeCandidate(idx)}
                  accessible={true}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove candidate ${cand}`}>
                  <FontAwesome
                    name="times-circle"
                    size={12}
                    color="#EF4444"
                    style={matrixStyles.removeIcon}
                  />
                </TouchableOpacity>
              </View>
            ))}
            {candidates.length === 0 && (
              <Text style={matrixStyles.noCandidatesText}>No candidates defined.</Text>
            )}
          </View>
        </View>

        <View style={matrixStyles.divider} />

        <View style={matrixStyles.stateHashSection}>
          <Text style={matrixStyles.controlLabel}>VKG State Hash</Text>
          <TextInput
            style={matrixStyles.textInput}
            value={stateHash}
            onChangeText={setStateHash}
            placeholder="State hash (e.g. vkg_genesis_a4f9)"
            placeholderTextColor="#64748B"
            accessibilityLabel="VKG State Hash input"
            accessibilityHint="Edit the VKG state hash"
          />
        </View>
      </View>

      <Text style={matrixStyles.sectionTitle}>Evaluated Projection Grid</Text>

      {/* Grid of Projections */}
      <View style={matrixStyles.grid}>
        {ROLES.map((role) => {
          const roleColor = ROLE_COLORS[role];

          return <AvatarProjectionCard key={role} role={role} data={data} roleColor={roleColor} />;
        })}
      </View>
    </View>
  );
}

const matrixStyles = StyleSheet.create({
  container: {
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  controlsCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    padding: 20,
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  controlRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 20,
  },
  controlCol: {
    flex: 1,
  },
  controlLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 8,
  },
  btnGroup: {
    flexDirection: 'row',
    gap: 12,
  },
  smallBtn: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  btnText: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: 'bold',
  },
  ratioIndicatorContainer: {
    height: 12,
    backgroundColor: '#1E293B',
    borderRadius: 6,
    overflow: 'hidden',
    marginTop: 12,
  },
  ratioIndicator: {
    height: '100%',
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: '#1E293B',
    marginVertical: 16,
  },
  candidatesSection: {
    width: '100%',
  },
  candidatesHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  addBtn: {
    backgroundColor: 'rgba(59, 130, 246, 0.1)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: 'rgba(59, 130, 246, 0.2)',
  },
  addBtnText: {
    color: '#60A5FA',
    fontSize: 12,
    fontWeight: '600',
  },
  candidatesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  candidateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  candidateText: {
    color: '#E2E8F0',
    fontSize: 12,
    marginRight: 8,
    maxWidth: 120,
  },
  removeIcon: {
    marginLeft: 2,
  },
  noCandidatesText: {
    color: '#64748B',
    fontSize: 13,
    fontStyle: 'italic',
  },
  stateHashSection: {
    width: '100%',
  },
  textInput: {
    backgroundColor: '#1E293B',
    borderColor: '#334155',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    color: '#F8FAFC',
    fontSize: 13,
  },
  grid: {
    gap: 16,
  },
  roleCard: {
    backgroundColor: '#0F172A',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1E293B',
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  roleCardHidden: {
    borderColor: '#1E293B',
    backgroundColor: '#0B1120',
    opacity: 0.8,
  },
  roleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderLeftWidth: 4,
    backgroundColor: '#1E293B',
    borderBottomWidth: 1,
    borderBottomColor: '#0F172A',
  },
  roleTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  roleBadge: {
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  surfaceText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#F8FAFC',
    letterSpacing: 0.5,
  },
  visibilityBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  visibilityText: {
    fontSize: 12,
    fontWeight: '600',
  },
  cardBody: {
    padding: 16,
  },
  cardBodyHidden: {
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hiddenMessage: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
    textAlign: 'center',
  },
  messageText: {
    color: '#E2E8F0',
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 12,
  },
  actionsGroup: {
    marginBottom: 12,
  },
  cardLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 6,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  actionBadgesList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  actionBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: 8,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.2)',
  },
  actionBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
  },
  noActionsText: {
    color: '#64748B',
    fontSize: 12,
    fontStyle: 'italic',
  },
  payloadSection: {
    marginTop: 6,
  },
  payloadBox: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  payloadText: {
    color: '#38BDF8',
    fontSize: 12,
    fontFamily: 'monospace',
    lineHeight: 18,
  },
  sliderSection: {
    marginBottom: 16,
  },
  sliderWrapper: {
    height: 40,
    justifyContent: 'center',
    marginVertical: 12,
  },
  sliderTrack: {
    height: 8,
    backgroundColor: '#1E293B',
    borderRadius: 4,
    position: 'relative',
    width: '100%',
  },
  sliderFill: {
    height: '100%',
    backgroundColor: '#3B82F6',
    borderRadius: 4,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderStepsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    position: 'absolute',
    top: -16,
    left: 0,
    right: 0,
    height: 40,
  },
  sliderStepPoint: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1E293B',
    borderWidth: 2,
    borderColor: '#334155',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  sliderStepPointActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#93C5FD',
    transform: [{ scale: 1.1 }],
  },
  sliderStepText: {
    color: '#94A3B8',
    fontSize: 11,
    fontWeight: '700',
  },
  sliderStepTextActive: {
    color: '#FFFFFF',
  },
});
