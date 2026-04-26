import logger from '../../utils/logger';
import { ControlPlaneDecision, ExecuteResult } from './types';
import { KubernetesExecutor } from './kubernetesExecutor';

export class ActionExecutor {
  private dryRun: boolean;
  private kube: KubernetesExecutor | null = null;

  constructor(dryRun: boolean) {
    this.dryRun = dryRun;
  }

  setDryRun(dryRun: boolean): void {
    this.dryRun = dryRun;
  }

  async execute(decision: ControlPlaneDecision): Promise<ExecuteResult> {
    const decisionId = `${decision.serviceName}:${decision.decisionType}:${decision.timestamp}`;
    const now = new Date().toISOString();

    if (this.dryRun) {
      logger.warn(
        `🧪 DRY_RUN control-plane execute: service=${decision.serviceName} action=${decision.decisionType} details=${decision.action.description}`
      );
      return {
        decisionId,
        executed: false,
        dryRun: true,
        timestamp: now,
        message: 'Dry-run enabled; no action executed',
      };
    }

    const enabled = process.env.CONTROL_PLANE_ENABLED === 'true';
    if (!enabled) {
      logger.error('❌ CONTROL_PLANE_ENABLED is not true; refusing to execute');
      return {
        decisionId,
        executed: false,
        dryRun: false,
        timestamp: now,
        message: 'Execution disabled (set CONTROL_PLANE_ENABLED=true)',
      };
    }

    // Lazy-init Kubernetes client only when actually executing.
    if (!this.kube) {
      this.kube = new KubernetesExecutor();
    }

    // Very strict allowlist mapping: serviceName -> deployment name
    // This keeps Phase 3 safe by default and avoids accidental cluster-wide actions.
    const namespace = process.env.CONTROL_PLANE_NAMESPACE || 'default';
    const mappingEnv = process.env.CONTROL_PLANE_DEPLOYMENT_MAP || '';
    const deploymentMap = parseDeploymentMap(mappingEnv);
    const deploymentName = deploymentMap.get(decision.serviceName);

    if (!deploymentName) {
      logger.error(`❌ No deployment mapping for service=${decision.serviceName}`);
      return {
        decisionId,
        executed: false,
        dryRun: false,
        timestamp: now,
        message: `No deployment mapping configured for service=${decision.serviceName}`,
      };
    }

    try {
      if (decision.decisionType === 'SCALE_UP' || decision.decisionType === 'SCALE_DOWN') {
        const target = decision.action.targetPods;
        if (!target || typeof target !== 'number' || target < 1) {
          return {
            decisionId,
            executed: false,
            dryRun: false,
            timestamp: now,
            message: 'Invalid targetPods for scaling action',
          };
        }

        await this.kube.scaleDeployment({ namespace, deploymentName, replicas: target });
        return {
          decisionId,
          executed: true,
          dryRun: false,
          timestamp: now,
          message: `Scaled ${namespace}/${deploymentName} to replicas=${target}`,
        };
      }

      // Phase 3 initial scope: only scale. Others remain dry-run/non-implemented.
      return {
        decisionId,
        executed: false,
        dryRun: false,
        timestamp: now,
        message: `Execution not implemented for decisionType=${decision.decisionType} (Phase 3 initial scope supports scaling only)`,
      };
    } catch (err: any) {
      logger.error(`❌ Kubernetes execution failed: ${err?.message || err}`);
      return {
        decisionId,
        executed: false,
        dryRun: false,
        timestamp: now,
        message: `Kubernetes execution failed: ${err?.message || err}`,
      };
    }
  }
}

function parseDeploymentMap(raw: string): Map<string, string> {
  // Format: "serviceA=deployment-a,serviceB=deployment-b"
  const m = new Map<string, string>();
  for (const part of raw.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const [svc, dep] = p.split('=').map(s => (s || '').trim());
    if (!svc || !dep) continue;
    m.set(svc, dep);
  }
  return m;
}

