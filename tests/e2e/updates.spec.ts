import {test,expect,type Page} from "@playwright/test";
import {fixtures,type Actor} from "../support";
async function login(page:Page,actor:Actor) {
  await page.goto("/login");await page.getByLabel("Email",{exact:true}).fill(actor.email);await page.getByLabel("Password",{exact:true}).fill(actor.password);await page.getByRole("button",{name:"Sign in",exact:true}).click();await expect(page).toHaveURL(/\/$/);
}
test("admin invites, employee consents, theme persists, and sign-out requires confirmation",async({browser}) => {
  test.setTimeout(180000);
  const f=await fixtures();const contexts=await Promise.all([browser.newContext(),browser.newContext({viewport:{width:390,height:844}})]);
  try {
    const admin=await f.actor("ui-admin",true),owner=await f.actor("ui-owner"),employee=await f.actor("ui-employee");
    const [python]=await f.ok<{id:string}[]>("/rest/v1/skills?name=eq.Python","GET",undefined,admin.token);
    await f.rpc(employee,"save_profile_skills",{p_display_name:employee.name,p_bio:"Synthetic contributor",p_existing_ids:[],p_learning_ids:[python.id],p_available_hours:3});
    const project=await f.rpc<string>(owner,"create_project_with_skills",{p_title:`UI assignment ${f.runId}`,p_description:"A fictional opportunity to practice Python and produce useful work.",p_skill_ids:[python.id],p_estimated_hours:4});
    await f.rpc(admin,"assign_owner",{p_project_id:project,p_owner_id:owner.id});await f.rpc(owner,"request_publication",{p_project_id:project});await f.rpc(admin,"review_publication",{p_project_id:project,p_approve:true});
    await f.rpc(admin,"set_directory_visibility",{p_hidden:true});
    const [adminPage,employeePage]=await Promise.all(contexts.map((c) => c.newPage()));
    await login(adminPage,admin);await login(employeePage,employee);
    await adminPage.goto(`/admin?tab=assignments&project=${project}`);
    await adminPage.getByLabel("Search people or skills",{exact:true}).fill(admin.email);
    await expect(adminPage.locator(".candidate-card").filter({hasText:admin.name})).toBeVisible();
    await adminPage.getByLabel("Search people or skills",{exact:true}).fill(employee.name);
    await adminPage.getByRole("checkbox",{name:`Select ${employee.name}`,exact:true}).check();
    await adminPage.getByRole("button",{name:"Invite selected",exact:true}).click();
    await expect(adminPage.getByText(/Invitations sent/)).toBeVisible();
    await employeePage.reload();
    await expect(employeePage.getByRole("heading",{name:"Suggested for you",exact:true})).toBeVisible();
    await employeePage.getByRole("link",{name:"View details",exact:true}).click();
    await expect(employeePage.getByText("You’re a participant.",{exact:true})).toHaveCount(0);
    await employeePage.goto("/");await employeePage.getByRole("button",{name:"Decline",exact:true}).click();
    await expect(employeePage.getByRole("heading",{name:"Suggested for you",exact:true})).toHaveCount(0);
    await adminPage.reload();await adminPage.getByLabel("Search people or skills",{exact:true}).fill(employee.name);
    await adminPage.getByRole("checkbox",{name:`Select ${employee.name}`,exact:true}).check();
    await adminPage.getByLabel("Invitation type",{exact:true}).selectOption("training");
    await adminPage.getByLabel("I intend to invite previous recipients again.",{exact:true}).check();
    await adminPage.getByRole("button",{name:"Invite selected",exact:true}).click();await expect(adminPage.getByText(/Invitations sent/)).toBeVisible();
    await employeePage.reload();await employeePage.getByRole("button",{name:"Accept",exact:true}).click();
    await adminPage.reload();await adminPage.getByLabel("Search people or skills",{exact:true}).fill(employee.name);
    const acceptedCandidate=adminPage.locator(".candidate-card").filter({hasText:employee.name});
    await expect(acceptedCandidate.getByText("Already participating",{exact:true})).toBeVisible();
    await expect(acceptedCandidate.getByRole("checkbox")).toHaveCount(0);
    await expect(employeePage.getByRole("heading",{name:"Profile",exact:true})).toBeVisible();
    await employeePage.goto("/projects?my=1&q=Python&status=open");await employeePage.getByRole("link",{name:"Clear filters",exact:true}).click();await expect(employeePage).toHaveURL(/\/projects\?my=1$/);
    await employeePage.getByLabel(`Account: ${employee.name}`,{exact:true}).click();
    const before=await employeePage.locator("html").getAttribute("data-theme");
    await employeePage.getByRole("switch",{name:/Dark mode/}).click();
    await expect(employeePage.locator("html")).toHaveAttribute("data-theme",before==="dark" ? "light" : "dark");
    await employeePage.reload();await expect(employeePage.locator("html")).toHaveAttribute("data-theme",before==="dark" ? "light" : "dark");
    await employeePage.getByLabel(`Account: ${employee.name}`,{exact:true}).click();await employeePage.getByRole("button",{name:"Sign out",exact:true}).click();
    await expect(employeePage.getByRole("dialog")).toBeVisible();await employeePage.getByRole("button",{name:"Cancel",exact:true}).click();await expect(employeePage.getByRole("dialog")).not.toBeVisible();
    await employeePage.getByLabel(`Account: ${employee.name}`,{exact:true}).click();await employeePage.getByRole("button",{name:"Sign out",exact:true}).click();await employeePage.getByRole("dialog").getByRole("button",{name:"Sign out",exact:true}).click();await expect(employeePage).toHaveURL(/\/login$/);
  } finally {await Promise.all(contexts.map((c) => c.close()));await f.cleanup();}
});
