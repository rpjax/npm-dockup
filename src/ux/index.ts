import pc from "picocolors";
import { printNextSteps } from "./next-steps.js";

export { formatRow, formatIndentedList } from "./align.js";
export { printSessionHeader, printSection } from "./session.js";
export {
  printDeployReport,
  printValidateReport,
  printInitReport,
  buildDeployJsonReport,
  type DeployReportContext,
  type ValidateReportContext,
  type InitReportContext,
} from "./run-report.js";
export {
  resolveDeployNextSteps,
  resolveValidateNextSteps,
  resolveInitNextSteps,
} from "./next-steps.js";
export { printErrorPanel, tailText } from "./error-panel.js";

export function printNextStepsBlock(steps: string[]): void {
  if (steps.length === 0) {
    return;
  }
  const useColor = pc.isColorSupported && process.stdout.isTTY === true && !process.env.NO_COLOR;
  printNextSteps(steps, useColor);
}
