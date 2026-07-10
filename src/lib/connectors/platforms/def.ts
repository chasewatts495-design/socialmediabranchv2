import type {
  Connector,
  ConnectorCapabilities,
  PublishPayload,
  ValidationIssue,
} from "../types";

export interface PlatformDefinition {
  capabilities: ConnectorCapabilities;
  /** Platform-specific checks beyond the generic constraint validation. */
  extraValidation?: (payload: PublishPayload) => ValidationIssue[];
  /** Phase 2: real API connector factory. Absent → live mode unavailable. */
  buildLiveConnector?: () => Connector;
}
