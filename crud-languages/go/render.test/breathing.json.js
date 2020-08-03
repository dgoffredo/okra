({
    package: 'main',
    imports: {
        'fmt': null
    },
    declarations: [{
            function: {
                name: 'doTheThing',
                parameters: [{
                        name: 'whatThings',
                        type: '[]string'
                    },
                    {
                        name: 'reallyThough',
                        type: 'bool'
                    }
                ],
                results: [],
                body: {
                    variables: [{
                        name: 'counter',
                        type: 'int',
                        value: {
                            call: {
                                function: 'len',
                                arguments: [{
                                    symbol: 'whatThings'
                                }]
                            }
                        }
                    }],
                    statements: [{
                        call: {
                            function: {
                                dot: ['fmt', 'Println']
                            },
                            arguments: ['the counter is at:', {
                                symbol: 'counter'
                            }]
                        }
                    }]
                }
            }
        },

        {
            function: {
                name: 'main',
                parameters: [],
                results: [],
                body: {
                    variables: [],
                    statements: [{
                        call: {
                            function: 'doTheThing',
                            arguments: [{
                                    sequenceLiteral: {
                                        type: '[]string',
                                        elements: ["foo", "bar"]
                                    }
                                },
                                true
                            ]
                        }
                    }]
                }
            }
        }
    ]
})