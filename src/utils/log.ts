const PREFIX = "[job-assistant]";

export function logInfo(message: string): void {
  console.log(`${PREFIX} ${message}`);
}

export function logDbOk(hhId: string, title: string): void {
  console.log(`${PREFIX} db ok hh_id=${hhId} title="${title}"`);
}

export function logDbFail(hhId: string, error: string): void {
  console.error(`${PREFIX} db fail hh_id=${hhId} error=${error}`);
}

export function logScrapeFail(hhId: string, error: string): void {
  console.error(`${PREFIX} scrape fail hh_id=${hhId} error=${error}`);
}
