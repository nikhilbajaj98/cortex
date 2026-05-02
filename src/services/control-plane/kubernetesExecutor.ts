import k8s from '@kubernetes/client-node';
import logger from '../../utils/logger';

export type KubeScaleRequest = {
  namespace: string;
  deploymentName: string;
  replicas: number;
};

export class KubernetesExecutor {
  private appsApi: k8s.AppsV1Api;

  constructor() {
    const kc = new k8s.KubeConfig();

    // Supports:
    // - in-cluster (serviceaccount)
    // - local kubeconfig (mounted / provided)
    try {
      kc.loadFromDefault();
    } catch (err: any) {
      // loadFromDefault can throw in weird environments; rethrow with clarity.
      throw new Error(`Failed to load Kubernetes config: ${err?.message || err}`);
    }

    this.appsApi = kc.makeApiClient(k8s.AppsV1Api);
  }

  async scaleDeployment(req: KubeScaleRequest): Promise<void> {
    const { namespace, deploymentName, replicas } = req;

    logger.info(`☸️ Scaling deployment ${namespace}/${deploymentName} -> replicas=${replicas}`);

    // Read current deployment
    const body = await this.appsApi.readNamespacedDeployment({
      name: deploymentName,
      namespace,
    });

    if (!body.spec) {
      throw new Error(`Deployment spec missing for ${namespace}/${deploymentName}`);
    }

    body.spec.replicas = replicas;

    await this.appsApi.replaceNamespacedDeployment({
      name: deploymentName,
      namespace,
      body,
    });
  }
}

