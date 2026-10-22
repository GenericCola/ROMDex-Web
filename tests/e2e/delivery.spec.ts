import {test,expect} from "@playwright/test";
test.use({serviceWorkers:"block"});
for(const uncertain of [false,true])test("manual save retains Auto-Sync off; uncertainty="+uncertain,async({page})=>{
  const raw={id:"2-test",idReadable:"PMON-900001",summary:"Synthetic cloud task",description:"Before",updated:1,project:{shortName:"PMON"},parent:{issues:[]},customFields:[],commentsCount:0,comments:[]};let posts=0;
  await page.route("https://thegobindsingh.youtrack.cloud/api/**",async route=>{
    const request=route.request(),url=new URL(request.url());const headers={"access-control-allow-origin":"*","access-control-allow-headers":"authorization,accept,content-type","access-control-allow-methods":"GET, POST, OPTIONS"};
    if(request.method()==="OPTIONS"){await route.fulfill({status:204,headers});return;}
    if(request.method()==="POST"){posts++;Object.assign(raw,JSON.parse(request.postData()??"{}"));if(uncertain){await route.abort();return;}await route.fulfill({headers,contentType:"application/json",body:"{}"});return;}
    const body=url.pathname.endsWith("/users/me")?{id:"fixture-owner"}:url.pathname==="/api/issues"?[raw]:raw;
    await route.fulfill({headers,contentType:"application/json",body:JSON.stringify(body)});
  });
  await page.goto("/");await page.getByRole("button",{name:"Connection Details",exact:true}).click();await page.getByLabel("YouTrack Permanent Token",{exact:true}).fill("fixture-read-token");await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();await page.getByRole("button",{name:"Save 1 Tasks in This Browser",exact:true}).click();
  await page.getByRole("button",{name:"Synthetic cloud task",exact:true}).last().click();await page.getByRole("textbox",{name:"Notes and Instructions",exact:true}).fill("After");
  await page.getByRole("button",{name:"Connection Details",exact:true}).click();await page.getByLabel("Session token for delivery",{exact:true}).fill("fixture-write-token");await page.getByRole("button",{name:"Enable delivery for this session",exact:true}).click();await expect(page.getByText("Saved. Use Save Changes to run one delivery cycle.",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Close Connection Details",exact:true}).click();
  await page.getByRole("button",{name:/^Save Changes/}).click();
  if(uncertain){await expect(page.getByText("The delivery result is uncertain. Your queued change is preserved for review.",{exact:true})).toBeVisible();await page.getByRole("button",{name:"Save Changes",exact:false}).click();expect(posts).toBe(1);await page.getByRole("button",{name:"Connection Details",exact:true}).click();await page.getByRole("button",{name:"Read back and confirm; do not resend",exact:true}).click();await expect(page.getByText("Uncertain delivery",{exact:true})).toHaveCount(0);await page.getByRole("button",{name:"Close Connection Details",exact:true}).click();}
  else await expect(page.getByText("Queued supported changes confirmed by YouTrack. Auto-Sync preference unchanged.",{exact:true})).toBeVisible();
  expect(posts).toBe(1);await expect(page.getByRole("switch",{name:"Auto-Sync Data",exact:true})).toHaveAttribute("aria-checked","false");await page.reload();await expect(page.getByRole("textbox",{name:"Notes and Instructions",exact:true})).toHaveValue("After");await expect(page.getByRole("switch",{name:"Auto-Sync Data",exact:true})).toBeDisabled();
});
