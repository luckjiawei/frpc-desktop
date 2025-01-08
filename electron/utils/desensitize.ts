export const maskSensitiveData = (
  obj: Record<string, any>,
  keysToMask: string[]
) => {
  const maskedObj = JSON.parse(JSON.stringify(obj));
  keysToMask.forEach(key => {
    if (maskedObj.hasOwnProperty(key)) {
      maskedObj[key] = "***";
    }
  });
  return maskedObj;
};
