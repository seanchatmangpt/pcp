import { HookBehavior } from '../../hook-otp/types';

export interface LivestreamState {
  streamStatus: 'healthy' | 'degraded' | 'escalated';
  bitrateKbps: number;
  packetLossRatio: number;
  incidentCount: number;
  operatorAlerted: boolean;
  memberNotified: boolean;
  escalated: boolean;
  resolved: boolean;
  history: string[];
}

export const livestreamIncidentBehavior: HookBehavior = {
  init: async () => ({
    streamStatus: 'healthy',
    bitrateKbps: 4500,
    packetLossRatio: 0.0,
    incidentCount: 0,
    operatorAlerted: false,
    memberNotified: false,
    escalated: false,
    resolved: true,
    history: ['Initialized livestream status as healthy.'],
  }),
  handleDelta: async (msg, ctx) => {
    const action = msg.payload.action;
    const effects: any[] = [];

    if (action === 'degrade') {
      const bitrate = msg.payload.bitrateKbps !== undefined ? msg.payload.bitrateKbps : 1500;
      const loss = msg.payload.packetLossRatio !== undefined ? msg.payload.packetLossRatio : 0.08;

      ctx.state.bitrateKbps = bitrate;
      ctx.state.packetLossRatio = loss;
      ctx.state.resolved = false;

      // Transition to degraded if healthy
      if (ctx.state.streamStatus === 'healthy') {
        ctx.state.streamStatus = 'degraded';
        ctx.state.incidentCount += 1;
        ctx.state.history.push(
          `Bitrate dropped to ${bitrate}kbps, packet loss at ${(loss * 100).toFixed(1)}%. Stream status degraded.`
        );
      } else {
        ctx.state.history.push(
          `Bitrate updated to ${bitrate}kbps, packet loss at ${(loss * 100).toFixed(1)}%.`
        );
      }

      // Check if we need to emit Operator Alert and suppress duplicate alerts
      if (!ctx.state.operatorAlerted) {
        ctx.state.operatorAlerted = true;
        effects.push({
          type: 'operator_alert',
          payload: {
            alertId: `op_alert_${Date.now()}`,
            message: `CRITICAL: Livestream performance degraded. Bitrate: ${bitrate}kbps, Packet Loss: ${(loss * 100).toFixed(1)}%.`,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Check if we need to notify members via projection
      if (!ctx.state.memberNotified) {
        ctx.state.memberNotified = true;
        effects.push({
          type: 'member_status_projection',
          payload: {
            message: 'We are experiencing connection issues with the video feed. Audio-only options are available.',
            timestamp: new Date().toISOString(),
          },
        });
      }
    } else if (action === 'escalate') {
      if (ctx.state.streamStatus === 'healthy') {
        throw new Error('Cannot escalate healthy stream. Degrade stream status first.');
      }

      ctx.state.streamStatus = 'escalated';
      ctx.state.escalated = true;
      ctx.state.history.push('Incident escalated to high-priority alert.');

      effects.push({
        type: 'operator_escalation_alert',
        payload: {
          alertId: `op_escalation_${Date.now()}`,
          message: `URGENT: Livestream incident escalated. Bitrate: ${ctx.state.bitrateKbps}kbps, Packet Loss: ${(ctx.state.packetLossRatio * 100).toFixed(1)}%. Immediate action required.`,
          timestamp: new Date().toISOString(),
        },
      });
    } else if (action === 'resolve') {
      ctx.state.streamStatus = 'healthy';
      ctx.state.bitrateKbps = 4500;
      ctx.state.packetLossRatio = 0.0;
      ctx.state.operatorAlerted = false;
      ctx.state.memberNotified = false;
      ctx.state.escalated = false;
      ctx.state.resolved = true;
      ctx.state.history.push('Livestream status returned to healthy. Incident resolved.');

      effects.push({
        type: 'operator_resolved_alert',
        payload: {
          message: 'Livestream incident resolved. Stream returned to healthy status.',
          timestamp: new Date().toISOString(),
        },
      });

      effects.push({
        type: 'member_resolved_notification',
        payload: {
          message: 'Video feed issues have been resolved. Thank you for your patience.',
          timestamp: new Date().toISOString(),
        },
      });
    }

    return effects;
  },
};
