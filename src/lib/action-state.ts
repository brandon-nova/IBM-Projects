export type ActionState = { success: boolean; message: string };
export type FormAction = (state: ActionState, data: FormData) => Promise<ActionState>;
export const initialState: ActionState = { success: false, message: "" };
