const wait = (ms) => new Promise((done) => { setTimeout(done, ms); });

export async function retryUntilOk(attempt, { times, delayMs }) {
  let result = attempt();
  for (let tries = 1; !result.ok && tries < times; tries += 1) {
    await wait(delayMs);
    result = attempt();
  }
  return result;
}
