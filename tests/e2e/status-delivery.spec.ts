import {test,expect} from "@playwright/test";
import {structuralFixture} from "./structural-fixture";
import {setStatus,expectAssigned,moveTask,selectTask as select} from "./task-status";
test.use({serviceWorkers:"block"});
test("a parent's own status survives child rollup, reload, refresh and last-child movement",async({page})=>{
  const s=await structuralFixture(page);await select(page,"Fixture Root");await setStatus(page,"Fixture Root","Standby");await s.connect();await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.state).toBe("To do");expect(s.writes).toHaveLength(0);
  await page.getByRole("button",{name:"Expand Fixture Root",exact:true}).last().click();await select(page,"Fixture Child");await setStatus(page,"Fixture Child","Complete");await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.state).toBe("Done");await select(page,"Fixture Root");await expectAssigned(page,"Fixture Root","Standby");
  await s.confirmed();await page.reload();await expect(page.getByRole("textbox",{name:"Task Title",exact:true})).toHaveValue("Fixture Root");await expectAssigned(page,"Fixture Root","Standby");await page.getByRole("button",{name:/^Connection Details/}).click();await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();await page.getByRole("button",{name:"Save 3 Tasks in This Browser",exact:true}).click();await expectAssigned(page,"Fixture Root","Standby");
  await select(page,"Fixture Child");await moveTask(page,"Fixture Child","PMON-900002");await s.connect();await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.state).toBe("Standby");expect(s.tasks.get("PMON-900002")?.state).toBe("Done");
  await page.getByRole("button",{name:"Delete Item",exact:true}).click();await page.getByRole("button",{name:"Delete Listed Items",exact:true}).click();await expect(page.getByRole("dialog",{name:"Queue deletion of listed tasks?",exact:true})).toHaveCount(0);await expect(page.getByRole("button",{name:/^Save Changes/})).toHaveAttribute("title",/queued change/);await s.save();await s.confirmed();expect(s.tasks.get("PMON-900002")?.state).toBe("To do");expect(s.writes.filter(write=>write.path.startsWith("/api/admin/"))).toEqual([]);
});
test("an interrupted parent rollup preserves the assignment and cannot be replayed after reload",async({page})=>{
  const s=await structuralFixture(page,"status-lost");s.tasks.get("PMON-900003")!.state="Done";await select(page,"Fixture Root");await setStatus(page,"Fixture Root","In Development");await s.connect();await s.save();await s.uncertain();expect(s.tasks.get("PMON-900001")?.state).toBe("Done");expect(s.writes.filter(write=>write.method==="POST")).toHaveLength(1);
  await page.reload();await s.connect();await s.save();await s.uncertain();await expect(page.getByText(/tasks? awaiting confirmation or review/)).toBeVisible();expect(s.writes.filter(write=>write.method==="POST")).toHaveLength(1);await page.getByRole("button",{name:/^Connection Details/}).click();await expect(page.getByRole("button",{name:/^Use my (changes|choice)/})).toHaveCount(0);await page.getByRole("button",{name:"Check whether this saved",exact:true}).click();await expect(page.locator(".delivery-review-card")).toHaveCount(0);await page.getByRole("button",{name:"Close Connection Details",exact:true}).click();await s.save();await s.confirmed();expect(s.writes.filter(write=>write.method==="POST")).toHaveLength(1);await expectAssigned(page,"Fixture Root","In Development");
});

test("PMON native testing reads keep the display label and priority, then deliver mapped parent status",async({page})=>{
  const s=await structuralFixture(page);
  s.tasks.get("PMON-900003")!.state="Needs Testing";
  s.tasks.get("PMON-900003")!.priority="Major";
  s.tasks.get("PMON-900002")!.parentId="PMON-900001";
  s.tasks.get("PMON-900002")!.state="In Development";
  await page.getByRole("button",{name:/^Connection Details/}).click();
  await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();
  await page.getByRole("button",{name:"Save 3 Tasks in This Browser",exact:true}).click();
  const root=page.getByRole("row").filter({has:page.getByRole("button",{name:"Fixture Root",exact:true})});
  await expect(root.getByRole("img",{name:"Awaiting Testing",exact:true})).toHaveClass("bulb amber");
  await page.getByRole("button",{name:"Expand Fixture Root",exact:true}).last().click();
  await select(page,"Fixture Child");
  await expectAssigned(page,"Fixture Child","Awaiting Testing");
  const priority=page.locator("#details").getByRole("combobox",{name:"priority for Fixture Child",exact:true});
  await expect(priority).toHaveValue("Major");
  expect(await priority.locator("option").evaluateAll(options=>options.map(option=>[(option as HTMLOptionElement).value,option.textContent]))).toEqual([["Minor","LOW"],["Normal","NORMAL"],["Major","HIGH"],["Critical","URGENT"]]);
  expect(s.writes).toHaveLength(0);
  await s.connect();await s.save();await s.confirmed();
  expect(s.tasks.get("PMON-900001")?.state).toBe("Needs Testing");
  expect(s.tasks.get("PMON-900003")?.state).toBe("Needs Testing");
  const writes=s.writes.length;await s.save();await s.confirmed();expect(s.writes).toHaveLength(writes);
  await s.confirmed();
  await page.reload();await expectAssigned(page,"Fixture Child","Awaiting Testing");
});

test("multiple all-Standby children inherit Standby; single and mixed children stay In Progress",async({page})=>{
 const s=await structuralFixture(page);
 for(const task of s.tasks.values())task.state="Standby";
 s.tasks.get("PMON-900002")!.parentId="PMON-900001";
 await page.getByRole("button",{name:/^Connection Details/}).click();
 await page.getByRole("button",{name:"Read YouTrack Tasks",exact:true}).click();
 await page.getByRole("button",{name:"Save 3 Tasks in This Browser",exact:true}).click();
 const row=(name:string)=>page.getByRole("row").filter({has:page.getByRole("button",{name,exact:true})});
 await expect(row("Fixture Root").getByRole("img",{name:"Standby",exact:true})).toHaveClass("bulb blue");
 await select(page,"Fixture Root");await expectAssigned(page,"Fixture Root","Standby");
 await page.getByRole("button",{name:"Expand Fixture Root",exact:true}).last().click();
 await expect(row("Fixture Child").getByRole("img",{name:"Standby",exact:true})).toHaveClass("bulb blue");
 await s.connect();await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.state).toBe("Standby");
 const count=s.writes.length;await s.save();await s.confirmed();expect(s.writes).toHaveLength(count);
 await select(page,"Fixture Other");await setStatus(page,"Fixture Other","Complete");
 await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.state).toBe("In Progress");
 await expect(row("Fixture Root").getByRole("img",{name:"In Progress",exact:true})).toBeVisible();
 await moveTask(page,"Fixture Other","PMON-900003");
 await s.save();await s.confirmed();expect(s.tasks.get("PMON-900001")?.state).toBe("Done");
 await setStatus(page,"Fixture Other","Standby");
 await s.save();await s.confirmed();expect(s.tasks.get("PMON-900003")?.state).toBe("In Progress");expect(s.tasks.get("PMON-900001")?.state).toBe("In Progress");
 await expect(row("Fixture Root").getByRole("img",{name:"In Progress",exact:true})).toHaveClass("bulb yellow");
 await select(page,"Fixture Root");await expectAssigned(page,"Fixture Root","Standby");
 await page.reload();await expect(row("Fixture Root").getByRole("img",{name:"In Progress",exact:true})).toHaveClass("bulb yellow");
 await expectAssigned(page,"Fixture Root","Standby");
});