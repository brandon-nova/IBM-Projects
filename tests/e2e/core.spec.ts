import { test, expect, type Page } from "@playwright/test";
import { fixtures, type Actor } from "../support";

async function login(page:Page,actor:Actor) {
  await page.goto("/login");
  await page.getByLabel("Email",{exact:true}).fill(actor.email);
  await page.getByLabel("Password",{exact:true}).fill(actor.password);
  await page.getByRole("button",{name:"Sign in",exact:true}).click();
  await expect(page).toHaveURL(/\/$/);
}
test("a contribution goes from proposal to owner-verified profile credit", async ({browser}) => {
  test.setTimeout(120000);
  const f = await fixtures();
  const contexts = await Promise.all([browser.newContext(),browser.newContext(),browser.newContext({viewport:{width:390,height:844}})]);
  try {
    const [admin,owner,contributor] = await Promise.all([f.actor("browser-admin",true),f.actor("browser-owner"),f.actor("browser-contributor")]);
    const [adminPage,ownerPage,contributorPage] = await Promise.all(contexts.map((c)=>c.newPage()));
    await Promise.all([login(adminPage,admin),login(ownerPage,owner),login(contributorPage,contributor)]);
    await adminPage.goto(`/people/${admin.id}?edit=1`);
    await adminPage.getByLabel("People visibility",{exact:true}).selectOption("true");
    await adminPage.getByRole("button",{name:"Save visibility",exact:true}).click();
    await expect(adminPage.getByText("People visibility saved.",{exact:true})).toBeVisible();
    await contributorPage.goto(`/people?q=${encodeURIComponent(admin.name)}`);
    await expect(contributorPage.getByRole("link",{name:admin.name,exact:true})).toHaveCount(0);
    await contributorPage.goto(`/people/${admin.id}`);
    await expect(contributorPage.getByRole("heading",{name:admin.name,exact:true})).toBeVisible();
    await contributorPage.goto(`/people/${contributor.id}?edit=1`);
    await expect(contributorPage.getByLabel("People visibility",{exact:true})).toHaveCount(0);
    await adminPage.getByLabel("People visibility",{exact:true}).selectOption("false");
    await adminPage.getByRole("button",{name:"Save visibility",exact:true}).click();
    await expect(adminPage.getByLabel("People visibility",{exact:true})).toHaveValue("false");
    await contributorPage.goto(`/people?q=${encodeURIComponent(admin.name)}`);
    await expect(contributorPage.getByRole("link",{name:admin.name,exact:true})).toBeVisible();
    await contributorPage.goto("/");
    await expect(contributorPage.getByRole("heading",{name:/What do you want to/})).toBeVisible();
    await expect(contributorPage.getByRole("link",{name:"Browse projects",exact:true})).toBeVisible();
    await expect(contributorPage.getByRole("link",{name:"Create a project",exact:true})).toBeVisible();
    expect(await contributorPage.evaluate(()=>document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    const title = `A useful microproject ${f.runId}`;
    await ownerPage.goto("/projects/new");
    await ownerPage.getByLabel("Project title",{exact:true}).fill(title);
    await ownerPage.getByLabel("Description",{exact:true}).fill("Make a small reporting script and provide clear instructions using synthetic data.");
    await ownerPage.getByRole("combobox",{name:/Skills needed/}).fill("Python");
    await ownerPage.getByRole("option",{name:"Python",exact:true}).click();
    await ownerPage.getByRole("combobox",{name:/Skills needed/}).fill("SQL");
    await ownerPage.getByRole("option",{name:"SQL",exact:true}).click();
    await ownerPage.getByRole("button",{name:"Create private proposal"}).click();
    await expect(ownerPage).toHaveURL(/\/projects\/[0-9a-f-]+$/);
    const projectPath = new URL(ownerPage.url()).pathname;
    await contributorPage.goto(projectPath);
    await expect(contributorPage.getByRole("heading",{name:"Page unavailable."})).toBeVisible();
    await ownerPage.getByRole("button",{name:"Request publication",exact:true}).click();
    await expect(ownerPage.getByText("Sent for approval.",{exact:false})).toBeVisible();
    await adminPage.goto("/admin");
    const approval = adminPage.locator(".approval-card").filter({has:adminPage.getByRole("heading",{name:title,exact:true})});
    await approval.getByLabel(`Official owner for ${title}`,{exact:true}).selectOption(owner.id);
    await approval.getByRole("button",{name:"Assign owner",exact:true}).click();
    await expect(approval.getByText("Official owner assigned.",{exact:true})).toBeVisible();
    await approval.getByRole("button",{name:"Approve publication",exact:true}).click();
    await expect(approval).toHaveCount(0);

    await contributorPage.goto(`/projects?q=${encodeURIComponent(title)}`);
    await contributorPage.getByRole("link",{name:title,exact:true}).click();
    await contributorPage.getByRole("button",{name:"Request to join",exact:true}).click();
    await expect(contributorPage.getByText("Your request is waiting for the owner.",{exact:true})).toBeVisible();
    await ownerPage.reload();
    await ownerPage.getByRole("button",{name:"Accept request",exact:true}).click();
    await expect(ownerPage.getByRole("heading",{name:"People who want to help",exact:true})).toHaveCount(0);
    await expect(ownerPage.getByRole("link",{name:contributor.name,exact:true})).toBeVisible();
    await contributorPage.reload();
    await contributorPage.getByLabel("Deliverable URL",{exact:true}).fill("https://example.com/fictional-script");
    await contributorPage.getByLabel("What did you accomplish?",{exact:true}).fill("Created a reporting script with clear setup instructions.");
    await contributorPage.getByLabel("What changed?",{exact:false}).fill("Illustrative outcome from fictional data only.");
    await contributorPage.getByRole("button",{name:"Submit work",exact:true}).click();
    await expect(contributorPage.getByText("Your work is awaiting review.",{exact:false})).toBeVisible();
    await ownerPage.reload();
    await ownerPage.getByLabel("I confirm this contribution was useful.",{exact:true}).check();
    await ownerPage.getByRole("button",{name:"Accept contribution",exact:true}).click();
    await expect(ownerPage.getByText("Accepted",{exact:true})).toBeVisible();

    await contributorPage.goto(`/people/${contributor.id}`);
    await expect(contributorPage.getByText("Verified",{exact:true})).toHaveCount(0);
    await ownerPage.getByRole("button",{name:"Complete project",exact:true}).click();
    await expect(ownerPage.getByRole("heading",{name:"Useful work, confirmed."})).toBeVisible();
    await contributorPage.reload();
    await expect(contributorPage.getByText("Verified",{exact:true})).toBeVisible();
    await expect(contributorPage.getByRole("link",{name:title,exact:true})).toBeVisible();
    await ownerPage.goto(`/people/${owner.id}`);
    await expect(ownerPage.getByText("Verified",{exact:true})).toHaveCount(0);
    await contributorPage.goto("/");
    for (const name of ["Profile","Learning","Projects"]) await expect(contributorPage.getByRole("heading",{name,exact:true})).toBeVisible();
  } finally {
    await Promise.all(contexts.map((c)=>c.close()));
    await f.cleanup();
  }
});
