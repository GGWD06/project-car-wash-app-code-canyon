/**
 * 校验密码强度
 * @param {string} password - 用户输入的密码
 * @returns {object} { level: number, message: string }
 * level: 0 (弱), 1 (中等), 2 (强)
 */
export const checkPasswordStrength = (password) => {
  if (!password) {
    return { level: 0, message: "" };
  }

  let typesCount = 0;
  if (/[A-Z]/.test(password)) typesCount++;
  if (/[a-z]/.test(password)) typesCount++;
  if (/[0-9]/.test(password)) typesCount++;
  if (/[!@#$%^&*(),.?":{}|<>]/.test(password)) typesCount++;

  if (password.length < 8) {
    return { level: 0, message: "Weak: Password must be at least 8 characters" };
  }

  if (typesCount < 2) {
    return { level: 0, message: "Weak: Include letters, numbers, or special characters" };
  } else if (typesCount === 2) {
    return { level: 1, message: "Medium: Consider adding more character types" };
  } else {
    return { level: 2, message: "Strong: Good password complexity" };
  }
};

/**
 * 校验两次密码是否一致
 * @param {string} password - 第一次输入的密码
 * @param {string} confirmPassword - 确认密码
 * @returns {object} { isMatch: boolean, message: string }
 */
export const validatePasswordMatch = (password, confirmPassword) => {
  if (!confirmPassword) {
    return { isMatch: true, message: "" };
  }
  
  if (password !== confirmPassword) {
    return { isMatch: false, message: "Passwords do not match" };
  }
  
  return { isMatch: true, message: "" };
};
