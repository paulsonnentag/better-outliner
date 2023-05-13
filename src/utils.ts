export function promisify<T>(value: T): Promise<T> {
  return new Promise((resolve, _) => {
    resolve(value);
  });
}
