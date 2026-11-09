(function () {
  "use strict";

  var summary = document.querySelector("[data-credit-summary]");
  if (!summary) return;

  var form = summary.closest("form");
  if (!form) return;

  var currentCredits = parseInt(summary.dataset.currentCredits, 10) || 0;
  var maxCredits = parseInt(summary.dataset.maxCredits, 10) || 0;
  var selectedCreditsEl = summary.querySelector("[data-selected-credits]");
  var totalCreditsEl = summary.querySelector("[data-total-credits]");
  var noteEl = summary.querySelector("[data-credit-note]");

  function pluralCredits(count) {
    return count + (count === 1 ? " credit" : " credits");
  }

  function updateSummary() {
    var selectedCredits = 0;
    var rows = form.querySelectorAll("[data-course-row]");

    rows.forEach(function (row) {
      var checkbox = row.querySelector('input[name="offeringIds"]');
      if (!checkbox || checkbox.disabled || !checkbox.checked) return;

      var credits = parseInt(row.dataset.credits, 10) || 0;
      var waitlist = row.querySelector('input[name="waitlistOfferingIds"]');

      // A full course with the waitlist option selected will be waitlisted,
      // so it does not count toward the enrolled credit total.
      if (row.dataset.full === "true" && waitlist && waitlist.checked) return;

      selectedCredits += credits;
    });

    var totalCredits = currentCredits + selectedCredits;

    selectedCreditsEl.textContent = String(selectedCredits);
    totalCreditsEl.textContent = String(totalCredits);

    if (totalCredits > maxCredits) {
      var overBy = totalCredits - maxCredits;
      summary.classList.add("over-limit");
      noteEl.textContent = pluralCredits(overBy) + " over the " + maxCredits + "-credit limit.";
      noteEl.classList.remove("muted");
      noteEl.classList.add("text-danger");
    } else {
      var remaining = maxCredits - totalCredits;
      summary.classList.remove("over-limit");
      noteEl.textContent = pluralCredits(remaining) + " remaining.";
      noteEl.classList.remove("text-danger");
      noteEl.classList.add("muted");
    }
  }

  form.addEventListener("change", function (event) {
    var target = event.target;
    if (
      target.matches('input[name="offeringIds"], input[name="waitlistOfferingIds"]')
    ) {
      updateSummary();
    }
  });

  updateSummary();
})();
