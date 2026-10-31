import { getPackExecutionConfiguration } from "./getPackExecutionConfiguration";
import { getPackConfigurationDigest } from "./getPackConfigurationDigest";
/** Only exact currently supported snapshots may authorize new work; accepted receipt polling is separate. */
export function assertPackQuoteConfiguration(
  quote: { execution_config?: unknown; execution_config_digest?: string } | null | undefined,
) {
  if (
    !quote?.execution_config ||
    !quote.execution_config_digest ||
    getPackConfigurationDigest(quote.execution_config) !== quote.execution_config_digest ||
    getPackConfigurationDigest(getPackExecutionConfiguration()) !== quote.execution_config_digest
  )
    throw new Error(
      "Pack execution configuration is missing or unsupported; get a new estimate and approve it before starting new work",
    );
}
