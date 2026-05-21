import EventKit
import Foundation
#if os(macOS)
import AppKit
#endif

struct HelperOutput: Encodable {
    let ok: Bool
    let platform: String?
    let reminders: [ReminderRecord]?
    let lists: [ReminderListRecord]?
    let calendars: [CalendarListRecord]?
    let events: [CalendarRecord]?
    let reminderId: String?
    let remindersStatus: AccessStatus?
    let calendarStatus: AccessStatus?
    let code: String?
    let message: String?
}

struct AccessStatus: Encodable {
    let authorization: String
}

struct ReminderRecord: Encodable {
    let id: String
    let name: String
    let listId: String
    let list: String
    let completed: Bool
    let dueDate: String?
    let notes: String?
    let priority: Int
    let url: String?
}

struct ReminderListRecord: Encodable {
    let id: String
    let name: String
}

struct CalendarListRecord: Encodable {
    let id: String
    let name: String
    let color: String?
    let writable: Bool
}

struct CalendarRecord: Encodable {
    let id: String
    let title: String
    let calendarId: String
    let calendar: String
    let calendarColor: String?
    let startDate: String
    let endDate: String?
    let allDay: Bool
    let location: String?
    let notes: String?
    let url: String?
}

func jsonEncoder() -> JSONEncoder {
    let encoder = JSONEncoder()
    encoder.outputFormatting = [.sortedKeys]
    return encoder
}

func isoString(from date: Date) -> String {
    let isoFormatter = ISO8601DateFormatter()
    isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return isoFormatter.string(from: date)
}

func dateKey(from components: DateComponents?) -> String? {
    guard let components,
          let year = components.year,
          let month = components.month,
          let day = components.day else {
        return nil
    }
    return String(format: "%04d-%02d-%02d", year, month, day)
}

func reminderDueString(from components: DateComponents?) -> String? {
    guard let date = dateKey(from: components) else {
        return nil
    }
    guard let hour = components?.hour, let minute = components?.minute else {
        return date
    }
    return String(format: "%@T%02d:%02d:00", date, hour, minute)
}

func hexColor(from calendar: EKCalendar) -> String? {
    #if os(macOS)
    guard let cgColor = calendar.cgColor else {
        return nil
    }

    let nsColor = NSColor(cgColor: cgColor)
    guard let rgbColor = nsColor?.usingColorSpace(.sRGB) else {
        return nil
    }

    return String(
        format: "#%02X%02X%02X",
        Int(round(rgbColor.redComponent * 255)),
        Int(round(rgbColor.greenComponent * 255)),
        Int(round(rgbColor.blueComponent * 255))
    )
    #else
    return nil
    #endif
}

func writeJson(_ output: HelperOutput, exitCode: Int32 = 0) -> Never {
    do {
        let data = try jsonEncoder().encode(output)
        FileHandle.standardOutput.write(data)
        FileHandle.standardOutput.write(Data("\n".utf8))
    } catch {
        FileHandle.standardError.write(Data("{\"ok\":false,\"code\":\"unknown_error\",\"message\":\"JSON encoding failed\"}\n".utf8))
    }
    Foundation.exit(exitCode)
}

func fail(_ code: String, _ message: String, exitCode: Int32) -> Never {
    writeJson(
        HelperOutput(
            ok: false,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: code,
            message: message
        ),
        exitCode: exitCode
    )
}

func authString(_ status: EKAuthorizationStatus) -> String {
    switch status {
    case .notDetermined:
        return "notDetermined"
    case .restricted:
        return "restricted"
    case .denied:
        return "denied"
    case .authorized:
        return "authorized"
    case .fullAccess:
        return "fullAccess"
    case .writeOnly:
        return "writeOnly"
    @unknown default:
        return "unknown"
    }
}

func hasReadAccess(_ status: EKAuthorizationStatus) -> Bool {
    let statusText = authString(status)
    return statusText == "fullAccess" || statusText == "authorized"
}

func requireAccess(_ entityType: EKEntityType) {
    let status = EKEventStore.authorizationStatus(for: entityType)
    if hasReadAccess(status) {
        return
    }

    switch status {
    case .notDetermined:
        fail("not_determined", "Apple access has not been requested yet.", exitCode: 3)
    case .denied:
        fail("permission_denied", "Apple access was denied in macOS Privacy & Security settings.", exitCode: 4)
    case .restricted:
        fail("restricted", "Apple access is restricted on this Mac.", exitCode: 5)
    default:
        fail("eventkit_error", "Apple access is not available.", exitCode: 6)
    }
}

func requestAccess(store: EKEventStore, entityType: EKEntityType) async -> String {
    do {
        if #available(macOS 14.0, *) {
            let granted: Bool
            if entityType == .event {
                granted = try await store.requestFullAccessToEvents()
            } else {
                granted = try await store.requestFullAccessToReminders()
            }
            return granted ? "fullAccess" : authString(EKEventStore.authorizationStatus(for: entityType))
        }

        return try await withCheckedThrowingContinuation { continuation in
            store.requestAccess(to: entityType) { granted, error in
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                continuation.resume(returning: granted ? "authorized" : authString(EKEventStore.authorizationStatus(for: entityType)))
            }
        }
    } catch {
        return authString(EKEventStore.authorizationStatus(for: entityType))
    }
}

func argumentValue(_ name: String) -> String? {
    let args = CommandLine.arguments
    guard let index = args.firstIndex(of: name), args.indices.contains(index + 1) else {
        return nil
    }
    return args[index + 1]
}

func hasArgument(_ name: String) -> Bool {
    CommandLine.arguments.contains(name)
}

func parseIsoDate(_ text: String?) -> Date? {
    guard let text else {
        return nil
    }

    if let date = ISO8601DateFormatter().date(from: text) {
        return date
    }

    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: text)
}

func parseDateKey(_ text: String?) -> DateComponents? {
    guard let text, !text.isEmpty else {
        return nil
    }

    let parts = text.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else {
        return nil
    }

    var components = DateComponents()
    components.calendar = Calendar(identifier: .gregorian)
    components.year = parts[0]
    components.month = parts[1]
    components.day = parts[2]
    return components.calendar?.date(from: components) == nil ? nil : components
}

func moveDate(_ date: Date, toDateKey targetDate: String, calendar: Calendar) -> Date? {
    guard let targetComponents = parseDateKey(targetDate) else {
        return nil
    }
    let timeComponents = calendar.dateComponents([.hour, .minute, .second, .nanosecond], from: date)

    var nextComponents = DateComponents()
    nextComponents.calendar = calendar
    nextComponents.timeZone = calendar.timeZone
    nextComponents.year = targetComponents.year
    nextComponents.month = targetComponents.month
    nextComponents.day = targetComponents.day
    nextComponents.hour = timeComponents.hour
    nextComponents.minute = timeComponents.minute
    nextComponents.second = timeComponents.second
    nextComponents.nanosecond = timeComponents.nanosecond
    return calendar.date(from: nextComponents)
}

func integerArgument(_ name: String) -> Int? {
    guard let text = argumentValue(name) else {
        return nil
    }
    return Int(text)
}

func dateTime(on date: Date, minutesFromMidnight: Int, calendar: Calendar) -> Date? {
    let safeMinutes = max(0, min(23 * 60 + 59, minutesFromMidnight))
    var components = calendar.dateComponents([.year, .month, .day], from: date)
    components.calendar = calendar
    components.timeZone = calendar.timeZone
    components.hour = safeMinutes / 60
    components.minute = safeMinutes % 60
    components.second = 0
    components.nanosecond = 0
    return calendar.date(from: components)
}

func readReminders(store: EKEventStore) {
    requireAccess(.reminder)

    let calendars = store.calendars(for: .reminder)
    let predicate = store.predicateForReminders(in: calendars)
    let semaphore = DispatchSemaphore(value: 0)
    var output: [ReminderRecord] = []
    var didComplete = false

    store.fetchReminders(matching: predicate) { reminders in
        output = (reminders ?? []).map { reminder in
            return ReminderRecord(
                id: reminder.calendarItemIdentifier,
                name: reminder.title ?? "Untitled reminder",
                listId: reminder.calendar.calendarIdentifier,
                list: reminder.calendar.title,
                completed: reminder.isCompleted,
                dueDate: reminderDueString(from: reminder.dueDateComponents),
                notes: reminder.notes,
                priority: reminder.priority,
                url: reminder.url?.absoluteString
            )
        }
        didComplete = true
        semaphore.signal()
    }

    _ = semaphore.wait(timeout: .now() + 30)
    if !didComplete {
        fail("timeout", "EventKit reminder fetch timed out.", exitCode: 8)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: output,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func readCalendar(store: EKEventStore) {
    requireAccess(.event)

    guard let from = parseIsoDate(argumentValue("--from")), let to = parseIsoDate(argumentValue("--to")) else {
        fail("invalid_arguments", "calendar requires --from and --to ISO dates.", exitCode: 2)
    }

    let calendars = store.calendars(for: .event)
    let predicate = store.predicateForEvents(withStart: from, end: to, calendars: calendars)
    let output = store.events(matching: predicate).map { event in
        CalendarRecord(
            id: event.eventIdentifier ?? event.calendarItemIdentifier,
            title: event.title ?? "Untitled event",
            calendarId: event.calendar.calendarIdentifier,
            calendar: event.calendar.title,
            calendarColor: hexColor(from: event.calendar),
            startDate: isoString(from: event.startDate),
            endDate: event.endDate.map { isoString(from: $0) },
            allDay: event.isAllDay,
            location: event.location,
            notes: event.notes,
            url: event.url?.absoluteString
        )
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: output,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func readReminderLists(store: EKEventStore) {
    requireAccess(.reminder)

    let output = store.calendars(for: .reminder).map { calendar in
        ReminderListRecord(id: calendar.calendarIdentifier, name: calendar.title)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: output,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func readCalendarLists(store: EKEventStore) {
    requireAccess(.event)

    let output = store.calendars(for: .event).map { calendar in
        CalendarListRecord(
            id: calendar.calendarIdentifier,
            name: calendar.title,
            color: hexColor(from: calendar),
            writable: calendar.allowsContentModifications
        )
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: output,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func setReminderCompleted(store: EKEventStore) {
    requireAccess(.reminder)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "set-reminder-completed requires --id.", exitCode: 2)
    }

    guard let completedText = argumentValue("--completed"), completedText == "true" || completedText == "false" else {
        fail("invalid_arguments", "set-reminder-completed requires --completed true or false.", exitCode: 2)
    }

    guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
        fail("not_found", "Apple Reminder no longer exists. Sync Task Hub and try again.", exitCode: 9)
    }

    reminder.completionDate = completedText == "true" ? Date() : nil

    do {
        try store.save(reminder, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func setReminderDue(store: EKEventStore) {
    requireAccess(.reminder)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "set-reminder-due requires --id.", exitCode: 2)
    }

    guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
        fail("not_found", "Apple Reminder no longer exists. Sync Task Hub and try again.", exitCode: 9)
    }

    reminder.dueDateComponents = dueDateComponents(from: argumentValue("--due"), startMinutes: integerArgument("--start-minutes"))

    do {
        try store.save(reminder, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func setReminderDetails(store: EKEventStore) {
    requireAccess(.reminder)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "set-reminder-details requires --id.", exitCode: 2)
    }

    guard let title = argumentValue("--title"), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        fail("invalid_arguments", "set-reminder-details requires --title.", exitCode: 2)
    }

    guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
        fail("not_found", "Apple Reminder no longer exists. Sync Task Hub and try again.", exitCode: 9)
    }

    reminder.title = title
    if hasArgument("--notes") {
        reminder.notes = argumentValue("--notes")
    }
    if hasArgument("--clear-due") {
        reminder.dueDateComponents = nil
    } else if argumentValue("--due") != nil || integerArgument("--start-minutes") != nil {
        reminder.dueDateComponents = dueDateComponents(from: argumentValue("--due"), startMinutes: integerArgument("--start-minutes"))
    }
    if let listId = argumentValue("--list-id"), !listId.isEmpty {
        guard let calendar = store.calendar(withIdentifier: listId), calendar.allowsContentModifications else {
            fail("not_found", "Apple Reminders list no longer exists or is not writable.", exitCode: 9)
        }
        reminder.calendar = calendar
    }

    do {
        try store.save(reminder, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func setReminderList(store: EKEventStore) {
    requireAccess(.reminder)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "set-reminder-list requires --id.", exitCode: 2)
    }

    guard let listId = argumentValue("--list-id"), !listId.isEmpty else {
        fail("invalid_arguments", "set-reminder-list requires --list-id.", exitCode: 2)
    }

    guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
        fail("not_found", "Apple Reminder no longer exists. Sync Task Hub and try again.", exitCode: 9)
    }

    guard let calendar = store.calendar(withIdentifier: listId), calendar.allowsContentModifications else {
        fail("not_found", "Apple Reminders list no longer exists or is not writable.", exitCode: 9)
    }

    reminder.calendar = calendar

    do {
        try store.save(reminder, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func applyCalendarEventTiming(event: EKEvent, targetDate: String, start: String?, end: String?, allDayText: String, startMinutes: Int?, durationMinutes: Int?) {
    let calendar = Calendar.current
    guard let originalStart = parseIsoDate(start) ?? event.startDate else {
        fail("invalid_arguments", "calendar event update requires --start ISO date.", exitCode: 2)
    }
    let originalEnd = parseIsoDate(end) ?? event.endDate ?? originalStart.addingTimeInterval(60 * 60)
    guard let nextStart = moveDate(originalStart, toDateKey: targetDate, calendar: calendar) else {
        fail("invalid_arguments", "calendar event update requires a real --date value.", exitCode: 2)
    }

    if let startMinutes {
        let duration = max(durationMinutes ?? Int(max(originalEnd.timeIntervalSince(originalStart), 60) / 60), 1)
        guard let timedStart = dateTime(on: nextStart, minutesFromMidnight: startMinutes, calendar: calendar) else {
            fail("invalid_arguments", "calendar event update requires valid --start-minutes.", exitCode: 2)
        }
        event.isAllDay = false
        event.startDate = timedStart
        event.endDate = timedStart.addingTimeInterval(TimeInterval(duration * 60))
    } else {
        let duration = max(originalEnd.timeIntervalSince(originalStart), 60)
        event.isAllDay = allDayText == "true"
        event.startDate = nextStart
        event.endDate = nextStart.addingTimeInterval(duration)
    }
}

func setCalendarEventDate(store: EKEventStore) {
    requireAccess(.event)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "set-calendar-event-date requires --id.", exitCode: 2)
    }

    guard let targetDate = argumentValue("--date"), parseDateKey(targetDate) != nil else {
        fail("invalid_arguments", "set-calendar-event-date requires --date YYYY-MM-DD.", exitCode: 2)
    }

    guard let allDayText = argumentValue("--all-day"), allDayText == "true" || allDayText == "false" else {
        fail("invalid_arguments", "set-calendar-event-date requires --all-day true or false.", exitCode: 2)
    }

    guard let event = store.event(withIdentifier: id) ?? store.calendarItem(withIdentifier: id) as? EKEvent else {
        fail("not_found", "Apple Calendar event no longer exists. Sync Task Hub and try again.", exitCode: 9)
    }

    applyCalendarEventTiming(
        event: event,
        targetDate: targetDate,
        start: argumentValue("--start"),
        end: argumentValue("--end"),
        allDayText: allDayText,
        startMinutes: integerArgument("--start-minutes"),
        durationMinutes: integerArgument("--duration-minutes")
    )

    do {
        try store.save(event, span: .thisEvent, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func setCalendarEventDetails(store: EKEventStore) {
    requireAccess(.event)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "set-calendar-event-details requires --id.", exitCode: 2)
    }

    guard let title = argumentValue("--title"), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        fail("invalid_arguments", "set-calendar-event-details requires --title.", exitCode: 2)
    }

    guard let targetDate = argumentValue("--date"), parseDateKey(targetDate) != nil else {
        fail("invalid_arguments", "set-calendar-event-details requires --date YYYY-MM-DD.", exitCode: 2)
    }

    guard let allDayText = argumentValue("--all-day"), allDayText == "true" || allDayText == "false" else {
        fail("invalid_arguments", "set-calendar-event-details requires --all-day true or false.", exitCode: 2)
    }

    guard let event = store.event(withIdentifier: id) ?? store.calendarItem(withIdentifier: id) as? EKEvent else {
        fail("not_found", "Apple Calendar event no longer exists. Sync Task Hub and try again.", exitCode: 9)
    }

    event.title = title
    if hasArgument("--notes") {
        event.notes = argumentValue("--notes")
    }
    if let calendarId = argumentValue("--calendar-id"), !calendarId.isEmpty {
        guard let calendar = store.calendar(withIdentifier: calendarId), calendar.allowsContentModifications else {
            fail("not_found", "Apple Calendar no longer exists or is not writable.", exitCode: 9)
        }
        event.calendar = calendar
    }
    applyCalendarEventTiming(
        event: event,
        targetDate: targetDate,
        start: argumentValue("--start"),
        end: argumentValue("--end"),
        allDayText: allDayText,
        startMinutes: integerArgument("--start-minutes"),
        durationMinutes: integerArgument("--duration-minutes")
    )

    do {
        try store.save(event, span: .thisEvent, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func dueDateComponents(from text: String?, startMinutes: Int? = nil) -> DateComponents? {
    guard let text, !text.isEmpty else {
        return nil
    }

    let parts = text.split(separator: "-").compactMap { Int($0) }
    guard parts.count == 3 else {
        fail("invalid_arguments", "create-reminder --due must use YYYY-MM-DD.", exitCode: 2)
    }

    var components = DateComponents()
    components.calendar = Calendar(identifier: .gregorian)
    components.year = parts[0]
    components.month = parts[1]
    components.day = parts[2]
    if let startMinutes {
        let safeMinutes = max(0, min(23 * 60 + 59, startMinutes))
        components.hour = safeMinutes / 60
        components.minute = safeMinutes % 60
    }
    guard components.calendar?.date(from: components) != nil else {
        fail("invalid_arguments", "create-reminder --due must be a real calendar date.", exitCode: 2)
    }
    return components
}

func createReminder(store: EKEventStore) {
    requireAccess(.reminder)

    guard let title = argumentValue("--title"), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        fail("invalid_arguments", "create-reminder requires --title.", exitCode: 2)
    }

    let reminder = EKReminder(eventStore: store)
    reminder.title = title
    if let listId = argumentValue("--list-id"), !listId.isEmpty {
        guard let calendar = store.calendar(withIdentifier: listId), calendar.allowsContentModifications else {
            fail("not_found", "Apple Reminders list no longer exists or is not writable.", exitCode: 9)
        }
        reminder.calendar = calendar
    } else {
        reminder.calendar = store.defaultCalendarForNewReminders() ?? store.calendars(for: .reminder).first
    }
    reminder.notes = argumentValue("--notes")
    reminder.dueDateComponents = dueDateComponents(from: argumentValue("--due"), startMinutes: integerArgument("--start-minutes"))

    guard reminder.calendar != nil else {
        fail("eventkit_error", "No writable Apple Reminders list is available.", exitCode: 7)
    }

    do {
        try store.save(reminder, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: reminder.calendarItemIdentifier,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func createCalendarEvent(store: EKEventStore) {
    requireAccess(.event)

    guard let title = argumentValue("--title"), !title.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty else {
        fail("invalid_arguments", "create-calendar-event requires --title.", exitCode: 2)
    }

    guard let dateComponents = parseDateKey(argumentValue("--date")),
          let startDate = Calendar.current.date(from: dateComponents) else {
        fail("invalid_arguments", "create-calendar-event requires --date YYYY-MM-DD.", exitCode: 2)
    }

    let selectedCalendar: EKCalendar?
    if let calendarId = argumentValue("--calendar-id"), !calendarId.isEmpty {
        selectedCalendar = store.calendar(withIdentifier: calendarId)
    } else {
        selectedCalendar = store.defaultCalendarForNewEvents ?? store.calendars(for: .event).first(where: { $0.allowsContentModifications })
    }

    guard let calendar = selectedCalendar, calendar.allowsContentModifications else {
        fail("eventkit_error", "No writable Apple Calendar is available.", exitCode: 7)
    }

    let event = EKEvent(eventStore: store)
    event.title = title
    event.notes = argumentValue("--notes")
    event.calendar = calendar
    if let startMinutes = integerArgument("--start-minutes") {
        let durationMinutes = max(integerArgument("--duration-minutes") ?? 60, 1)
        guard let timedStart = dateTime(on: startDate, minutesFromMidnight: startMinutes, calendar: Calendar.current) else {
            fail("invalid_arguments", "create-calendar-event requires valid --start-minutes.", exitCode: 2)
        }
        event.isAllDay = false
        event.startDate = timedStart
        event.endDate = timedStart.addingTimeInterval(TimeInterval(durationMinutes * 60))
    } else {
        let durationMinutes = max(integerArgument("--duration-minutes") ?? 24 * 60, 1)
        event.isAllDay = true
        event.startDate = startDate
        event.endDate = startDate.addingTimeInterval(TimeInterval(durationMinutes * 60))
    }

    do {
        try store.save(event, span: .thisEvent, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func deleteReminder(store: EKEventStore) {
    requireAccess(.reminder)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "delete-reminder requires --id.", exitCode: 2)
    }
    guard let reminder = store.calendarItem(withIdentifier: id) as? EKReminder else {
        fail("not_found", "Apple Reminder no longer exists.", exitCode: 9)
    }

    do {
        try store.remove(reminder, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

func deleteCalendarEvent(store: EKEventStore) {
    requireAccess(.event)

    guard let id = argumentValue("--id"), !id.isEmpty else {
        fail("invalid_arguments", "delete-calendar-event requires --id.", exitCode: 2)
    }
    guard let event = store.event(withIdentifier: id) ?? store.calendarItem(withIdentifier: id) as? EKEvent else {
        fail("not_found", "Apple Calendar event no longer exists.", exitCode: 9)
    }

    do {
        try store.remove(event, span: .thisEvent, commit: true)
    } catch {
        fail("eventkit_error", error.localizedDescription, exitCode: 7)
    }

    writeJson(
        HelperOutput(
            ok: true,
            platform: nil,
            reminders: nil,
            lists: nil,
            calendars: nil,
            events: nil,
            reminderId: nil,
            remindersStatus: nil,
            calendarStatus: nil,
            code: nil,
            message: nil
        )
    )
}

@main
struct TaskHubAppleHelper {
    static func main() async {
        #if os(macOS)
        let command = CommandLine.arguments.dropFirst().first ?? "status"
        let store = EKEventStore()

        switch command {
        case "status":
            writeJson(
                HelperOutput(
                    ok: true,
                    platform: "macos",
                    reminders: nil,
                    lists: nil,
                    calendars: nil,
                    events: nil,
                    reminderId: nil,
                    remindersStatus: AccessStatus(authorization: authString(EKEventStore.authorizationStatus(for: .reminder))),
                    calendarStatus: AccessStatus(authorization: authString(EKEventStore.authorizationStatus(for: .event))),
                    code: nil,
                    message: nil
                )
            )
        case "request-access":
            let remindersEnabled = CommandLine.arguments.contains("--reminders")
            let calendarEnabled = CommandLine.arguments.contains("--calendar")
            let remindersStatus = remindersEnabled
                ? await requestAccess(store: store, entityType: .reminder)
                : authString(EKEventStore.authorizationStatus(for: .reminder))
            let calendarStatus = calendarEnabled
                ? await requestAccess(store: store, entityType: .event)
                : authString(EKEventStore.authorizationStatus(for: .event))

            writeJson(
                HelperOutput(
                    ok: true,
                    platform: nil,
                    reminders: nil,
                    lists: nil,
                    calendars: nil,
                    events: nil,
                    reminderId: nil,
                    remindersStatus: AccessStatus(authorization: remindersStatus),
                    calendarStatus: AccessStatus(authorization: calendarStatus),
                    code: nil,
                    message: nil
                )
            )
        case "reminders":
            readReminders(store: store)
        case "reminder-lists":
            readReminderLists(store: store)
        case "calendar-lists":
            readCalendarLists(store: store)
        case "calendar":
            readCalendar(store: store)
        case "set-reminder-completed":
            setReminderCompleted(store: store)
        case "set-reminder-due":
            setReminderDue(store: store)
        case "set-reminder-details":
            setReminderDetails(store: store)
        case "set-calendar-event-date":
            setCalendarEventDate(store: store)
        case "set-calendar-event-details":
            setCalendarEventDetails(store: store)
        case "set-reminder-list":
            setReminderList(store: store)
        case "create-reminder":
            createReminder(store: store)
        case "create-calendar-event":
            createCalendarEvent(store: store)
        case "delete-reminder":
            deleteReminder(store: store)
        case "delete-calendar-event":
            deleteCalendarEvent(store: store)
        default:
            fail("invalid_arguments", "Unknown command: \(command)", exitCode: 2)
        }
        #else
        fail("not_macos", "Task Hub Apple helper only supports macOS.", exitCode: 2)
        #endif
    }
}
