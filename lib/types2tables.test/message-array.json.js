// one message type with a field that's an array of some non-enum builtin type
[{
    kind: 'message',
    name: '.stats.VoltageSample',
    description: 'voltage measured from a device',
    idFieldName: 'start',
    fields: [
        {id: 1, name: 'start', type: {builtin: '.google.protobuf.Timestamp'}},
        {id: 2, name: 'stop', type: {builtin: '.google.protobuf.Timestamp'}},
        {id: 3, name: 'mean', type: {builtin: 'TYPE_DOUBLE'}},
        {id: 4, name: 'standardDeviation', type: {builtin: 'TYPE_DOUBLE'},
         description: '*sample* standard deviation'},
        {id: 5, name: 'rawValues', type: {array: {builtin: 'TYPE_DOUBLE'}},
         description: "here's the array"}
    ]
}]
