"use strict";

const Gym = require("./gym");
const Utils = require("./utils");
const Fuse = require("fuse.js");

let GymZone = function (gyms, name, options) {
    if (!gyms || !Array.isArray(gyms) || (gyms.length < 1)) {
        throw new Error("GymZone initializer must be an array with at least one element.");
    }

    this.name = name;
    this.byOfficialName = {};
    this.byFriendlyName = {};
    this.all = [];
    this.ambiguous = [];
    this.fuzzyThreshold = (options && (typeof options.fuzzyThreshold === "number")) ? options.fuzzyThreshold : 0.2;

    gyms.forEach((gym) => this.addGym(gym, options));

    const fuseOptions = {
        shouldSort: true,
        caseSensitive: false,
        includeScore: true,
        threshold: this.fuzzyThreshold,
        location: 0,
        distance: 100,
        maxPatternLength: 32,
        minMatchCharLength: 1,
        keys: [
            {
                name: "friendlyName",
                weight: 0.6,
            },
            {
                name: "officialName",
                weight: 0.4,
            },
        ],
    };

    this.search = new Fuse(this.all, fuseOptions); // "RaidData" is the item array
};

GymZone.prototype.addGym = function (gym, options) {
    if (this.search !== undefined) {
        throw new Error(`Cannot add "${gym.friendlyName}": GymZone has already been initialized.`);
    }

    if ((gym instanceof Gym) !== true) {
        throw new Error("All GymZone initializers must be Gym objects.");
    }

    if (this.name && (!gym.belongsToZone(this.name))) {
        if (options && options.ignoreOtherZones) {
            return;
        }
        throw new Error(`Gym "${gym.friendlyName}" does not belong to zone "${this.name}".`);
    }

    if (this.byFriendlyName.hasOwnProperty(gym.normalized.friendlyName)) {
        throw new Error(`Duplicate normalized friendly names "${gym.normalized.friendlyName}".`);
    }

    this.all.push(gym);
    this.byFriendlyName[gym.normalized.friendlyName] = gym;

    if (!this.byOfficialName.hasOwnProperty(gym.normalized.officialName)) {
        this.byOfficialName[gym.normalized.officialName] = gym;
    }
    else {
        let existing = this.byOfficialName[gym.normalized.officialName];
        if (!Array.isArray(existing)) {
            this.ambiguous.push(existing);
            this.byOfficialName[gym.normalized.officialName] = [existing];
            existing = this.byOfficialName[gym.normalized.officialName];
        }
        existing.push(gym);
        this.ambiguous.push(gym);
    }
};

GymZone.adjustForCities = function (candidates, options) {
    let matched = [];
    let unmatched = [];

    let cities = Utils.normalize(options.cities);
    candidates.forEach((candidate) => {
        if (cities.includes(candidate.gym.normalized.city)) {
            matched.push(candidate);
        }
        else {
            unmatched.push({
                gym: candidate.gym,
                score: candidate.score * 0.9,
            });
        }
    });

    return (matched.length > 0) || (options && options.onlyMatchingCities) ? matched : unmatched;
};

GymZone.prototype.tryGetGymsExact = function (name) {
    let candidates = [];
    let normalized = Utils.normalize(name);
    let exact = this.byFriendlyName[normalized] || this.byOfficialName[normalized];
    if (exact) {
        (Array.isArray(exact) ? exact : [exact]).forEach((gym) => {
            candidates.push({
                gym: gym,
                score: 1,
            });
        });
    }
    return candidates;
};

GymZone.prototype.tryGetGymsFuzzy = function (name) {
    let candidates = [];

    let matches = this.search.search(name);
    if (matches.length > 0) {
        matches.forEach((match) => {
            candidates.push({
                gym: match.item,
                score: 1 - match.score,
            });
        });
    }

    return candidates;
};

GymZone.prototype.tryGetGyms = function (name, options) {
    let candidates = [];
    options = options || {};

    if (options.noExact !== true) {
        candidates = this.tryGetGymsExact(name);
    }

    if ((candidates.length < 1) && (options.noFuzzy !== true)) {
        candidates = this.tryGetGymsFuzzy(name, options);
    }

    if ((candidates.length > 1) && (options.cities && (options.cities.length > 0))) {
        candidates = GymZone.adjustForCities(candidates, options);
    }

    return candidates;
};

GymZone.fromCsvData = function (csv, name, options) {
    let gyms = [];
    csv.forEach((row) => {
        gyms.push(Gym.fromCsvRow(row));
    });
    return new GymZone(gyms, name, options);
};

module.exports = GymZone;

