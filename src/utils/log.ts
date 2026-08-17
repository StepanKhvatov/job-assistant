const PREFIX = "[job-assistant]";

export function vacancyRef(provider: string, externalId: string): string {
  return `provider=${provider} id=${externalId}`;
}

export function logInfo(message: string): void {
  console.log(`${PREFIX} ${message}`);
}

export function logDbOk(provider: string, externalId: string, title: string): void {
  console.log(`${PREFIX} db ok ${vacancyRef(provider, externalId)} title="${title}"`);
}

export function logDbFail(provider: string, externalId: string, error: string): void {
  console.error(`${PREFIX} db fail ${vacancyRef(provider, externalId)} error=${error}`);
}

export function logScrapeFail(provider: string, externalId: string, error: string): void {
  console.error(`${PREFIX} scrape fail ${vacancyRef(provider, externalId)} error=${error}`);
}
