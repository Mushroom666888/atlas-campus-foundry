import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { createRuntime } from "../server/runtime-server.js";
import type { RuntimeConfig } from "../packages/modules/src/runtime.js";
import type { InjectOptions } from "fastify";

test("campus domain: relational integrity, permissions, affiliation privacy, event linkage and restart", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "atlas-campus-"));
  const config: RuntimeConfig = {
    appId: "campus-domain-test",
    dataDir: root,
    modules: ["identity", "campus", "events", "content", "notifications"],
    recipes: [],
    spec: {
      name: "Campus directory",
      description: "Relational domain acceptance",
      kind: "events",
      modules: ["identity", "campus", "events", "content", "notifications"],
      features: [],
      primaryColor: "green",
    },
  };
  let runtime = await createRuntime(config);
  try {
    async function register(email: string) {
      const result = await runtime.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email, password: "CampusDomain123" },
      });
      assert.equal(result.statusCode, 201, result.body);
      return {
        cookie: result.headers["set-cookie"]!.toString().split(";")[0],
        user: result.json().user.id,
      };
    }
    const owner = await register("owner@campus.test"),
      other = await register("other@campus.test");
    async function request(
      method: InjectOptions["method"],
      url: string,
      payload?: unknown,
      cookie = owner.cookie,
      status = method === "POST" ? 201 : 200,
    ) {
      const result = await runtime.app.inject({
        method,
        url,
        payload: payload === undefined ? undefined : JSON.stringify(payload),
        headers: {
          cookie,
          ...(payload === undefined
            ? {}
            : { "content-type": "application/json" }),
        },
      });
      assert.equal(
        result.statusCode,
        status,
        `${method} ${url}: ${result.body}`,
      );
      return result.json();
    }
    const university = await request("POST", "/api/campus/universities", {
      name: "Test university A",
    });
    const schoolB = await request(
      "POST",
      "/api/campus/universities",
      { name: "Test university B" },
      other.cookie,
    );
    const campus = await request("POST", "/api/campus/campuses", {
      name: "North campus",
      university_id: university.id,
      timezone: "Asia/Taipei",
    });
    const otherCampus = await request(
      "POST",
      "/api/campus/campuses",
      { name: "South campus", university_id: schoolB.id },
      other.cookie,
    );
    const building = await request("POST", "/api/campus/buildings", {
      name: "Science building",
      university_id: university.id,
      campus_id: campus.id,
    });
    const venueInput = {
      name: "Room 101",
      university_id: university.id,
      campus_id: campus.id,
      building_id: building.id,
      capacity: 30,
    };
    const venue = await request("POST", "/api/campus/venues", venueInput);
    await request(
      "POST",
      "/api/campus/venues",
      { ...venueInput, campus_id: otherCampus.id },
      owner.cookie,
      422,
    );
    await request("POST", "/api/campus/venues", venueInput, other.cookie, 403);
    await request(
      "POST",
      "/api/campus/venues",
      { ...venueInput, latitude: 20 },
      owner.cookie,
      400,
    );
    await request(
      "POST",
      "/api/campus/campuses",
      {
        name: "Invalid timezone",
        university_id: university.id,
        timezone: "Not/Real",
      },
      owner.cookie,
      400,
    );
    await request("PUT", `/api/campus/venues/${venue.id}`, {
      ...venueInput,
      capacity: 40,
    });
    await request(
      "PUT",
      `/api/campus/venues/${venue.id}`,
      { ...venueInput, campus_id: otherCampus.id },
      owner.cookie,
      409,
    );
    const course = await request("POST", "/api/campus/courses", {
      name: "Distributed systems",
      code: "CS401",
      university_id: university.id,
      campus_id: campus.id,
    });
    await request(
      "POST",
      "/api/campus/courses",
      { name: "Duplicate", code: "CS401", university_id: university.id },
      owner.cookie,
      409,
    );
    const club = await request("POST", "/api/campus/clubs", {
      name: "Open source club",
      university_id: university.id,
      campus_id: campus.id,
    });
    await assert.rejects(
      runtime.db.query(
        "INSERT INTO campus_venues(id,university_id,campus_id,name,capacity) VALUES($1,$2,$3,'Invalid cross-school',1)",
        [crypto.randomUUID(), university.id, otherCampus.id],
      ),
      { code: "23503" },
    );
    for (const school of [university, schoolB]) {
      const affiliation = await request("PUT", "/api/campus/me/affiliations", {
        university_id: school.id,
        program: "Computing",
      });
      assert.equal(affiliation.verification, "self-declared");
    }
    assert.equal(
      (await request("GET", "/api/campus/me/affiliations")).items.length,
      2,
    );
    assert.equal(
      (
        await request(
          "GET",
          "/api/campus/me/affiliations",
          undefined,
          other.cookie,
        )
      ).items.length,
      0,
    );
    await request(
      "PUT",
      "/api/campus/me/affiliations",
      { university_id: university.id, user_id: other.user, verified: true },
      owner.cookie,
      400,
    );
    await request(
      "PUT",
      "/api/campus/me/affiliations",
      { university_id: university.id, campus_id: otherCampus.id },
      owner.cookie,
      422,
    );
    await request(
      "PUT",
      `/api/campus/universities/${schoolB.id}`,
      { name: schoolB.name, allow_affiliations: false },
      other.cookie,
    );
    await request(
      "PUT",
      "/api/campus/me/affiliations",
      { university_id: schoolB.id },
      owner.cookie,
      409,
    );
    const event = await request("POST", "/api/entities", {
      kind: "event",
      title: "Study meeting",
      data: { capacity: 20 },
    });
    const eventUrl = `/api/campus/events/${event.id}/location`;
    await request("PUT", eventUrl, {
      university_id: university.id,
      venue_id: venue.id,
      club_id: club.id,
    });
    await request(
      "PUT",
      eventUrl,
      { university_id: schoolB.id, venue_id: venue.id },
      owner.cookie,
      422,
    );
    await request(
      "PUT",
      eventUrl,
      { university_id: university.id },
      other.cookie,
      403,
    );
    assert.equal(
      (await request("GET", eventUrl)).location.venue_name,
      venue.name,
    );
    await request(
      "DELETE",
      `/api/campus/venues/${venue.id}`,
      undefined,
      owner.cookie,
      409,
    );
    await request(
      "DELETE",
      `/api/campus/universities/${university.id}`,
      undefined,
      owner.cookie,
      409,
    );
    await request(
      "DELETE",
      `/api/campus/courses/${course.id}`,
      undefined,
      other.cookie,
      403,
    );
    const firstPage = await request(
      "GET",
      "/api/campus/universities?limit=1&offset=0",
    );
    const secondPage = await request(
      "GET",
      "/api/campus/universities?limit=1&offset=1",
    );
    assert.equal(firstPage.total, 2);
    assert.notEqual(firstPage.items[0].id, secondPage.items[0].id);
    assert.equal(
      (await request("GET", "/api/campus/venues?q=%27%20OR%201%3D1--")).total,
      0,
    );
    await runtime.app.close();
    runtime = await createRuntime(config);
    assert.equal(
      (await request("GET", eventUrl)).location.venue_name,
      venue.name,
    );
    assert.equal(
      (
        await request(
          "GET",
          `/api/campus/courses?universityId=${university.id}`,
        )
      ).items[0].id,
      course.id,
    );
    await request("PUT", eventUrl, null);
    await request("DELETE", `/api/campus/venues/${venue.id}`);
    await request("DELETE", `/api/campus/me/affiliations/${university.id}`);
    assert.equal(
      (await request("GET", "/api/campus/me/affiliations")).items.length,
      1,
    );
    const isolated = await createRuntime({
      ...config,
      dataDir: path.join(root, "independent"),
      appId: "separate-app",
      modules: ["identity"],
    });
    try {
      assert.equal(
        (
          await isolated.app.inject({
            url: "/api/campus/universities",
            headers: { cookie: owner.cookie },
          })
        ).statusCode,
        401,
      );
      const registered = await isolated.app.inject({
        method: "POST",
        url: "/api/auth/register",
        payload: { email: "same@campus.test", password: "CampusDomain123" },
      });
      const cookie = registered.headers["set-cookie"]!.toString().split(";")[0];
      assert.equal(
        (
          await isolated.app.inject({
            url: "/api/campus/universities",
            headers: { cookie },
          })
        ).statusCode,
        409,
      );
      assert.equal(
        (await isolated.db.query("SELECT * FROM campus_universities")).rows
          .length,
        0,
      );
    } finally {
      await isolated.app.close();
    }
  } finally {
    await runtime.app.close();
    await rm(root, { recursive: true, force: true });
  }
});
