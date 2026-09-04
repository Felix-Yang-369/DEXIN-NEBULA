export type ActionFieldErrors = Record<string, string[]>;

export type ActionResult<T = undefined> =
  | {
      ok: true;
      code: string;
      messageCode: string;
      data?: T;
    }
  | {
      ok: false;
      code: string;
      messageCode: string;
      fieldErrors?: ActionFieldErrors;
    };

export function actionSuccess<T>(
  code: string,
  messageCode: string,
  data?: T,
): ActionResult<T> {
  return { ok: true, code, messageCode, data };
}

export function actionFailure(
  code: string,
  messageCode: string,
  fieldErrors?: ActionFieldErrors,
): ActionResult {
  return { ok: false, code, messageCode, fieldErrors };
}
