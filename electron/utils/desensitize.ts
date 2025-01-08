export const maskSensitiveData = (
  obj: Record<string, any>,
  keysToMask: string[]
) => {
  console.log("obj", obj);
  const maskedObj = JSON.parse(JSON.stringify(obj));
  console.log("masked", maskedObj);
  keysToMask.forEach(key => {
    if (maskedObj.hasOwnProperty(key)) {
      maskedObj[key] = "***";
    }
  });
  return maskedObj;
};
