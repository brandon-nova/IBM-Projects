import { test } from "node:test";
import assert from "node:assert/strict";
import { signupSchema, passwordSchema } from "../src/lib/validation.ts";

test("signup and password reset require matching password confirmation", () => {
  for (const schema of [signupSchema,passwordSchema]) {
    const input = {display_name:"Fictional Person",email:"fictional@ibm.com",password:"fictional-password-123",confirm_password:"fictional-password-123"};
    assert.equal(schema.safeParse(input).success,true);
    for (const confirm_password of [undefined,"","different-password-123","fictional-password-123 "]) {
      const result = schema.safeParse({...input,confirm_password});
      assert.equal(result.success,false);
      if (!result.success) assert.ok(result.error.issues.some((issue) => issue.path[0] === "confirm_password"));
    }
    assert.equal(schema.safeParse({...input,password:"short",confirm_password:"short"}).success,false);
  }
});
